<?php

namespace App\Console\Commands;

use App\Mail\BookingReminder;
use App\Models\BookingRequest;
use App\Services\BrevoSmsSender;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class SendBookingReminders extends Command
{
    protected $signature = 'bookings:send-reminders';

    protected $description = 'Send email reminders for upcoming approved bookings';

    public function handle(): int
    {
        $daysBefore = (int) (DB::table('system_settings')
            ->where('key', 'booking_reminder_days_before')
            ->value('value') ?? 1);

        if (! in_array($daysBefore, [1, 3, 5], true)) {
            Log::error('Invalid booking reminder setting; expected 1, 3, or 5 days.', [
                'days_before' => $daysBefore,
            ]);

            return self::FAILURE;
        }

        $today = CarbonImmutable::now('Asia/Manila')->startOfDay();
        $latestReminderDate = $today->addDays($daysBefore)->toDateString();
        $smsEnabled = DB::table('system_settings')
            ->where('key', 'booking_reminder_sms_enabled')
            ->value('value') === '1';
        $failed = false;

        BookingRequest::query()
            ->with(['user', 'resource'])
            ->where('status', 'approved')
            ->whereDate('start_date', '>', $today->toDateString())
            ->whereDate('start_date', '<=', $latestReminderDate)
            ->where(function ($query) use ($smsEnabled): void {
                $query->whereNull('reminder_sent_at');
                if ($smsEnabled) {
                    $query->orWhereNull('reminder_sms_sent_at');
                }
            })
            ->orderBy('booking_id')
            ->chunkById(100, function ($bookings) use (&$failed, $smsEnabled): void {
                foreach ($bookings as $booking) {
                    if ($booking->reminder_sent_at === null) {
                        $recipient = filter_var($booking->email, FILTER_VALIDATE_EMAIL)
                            ? $booking->email
                            : $booking->user?->email;

                        if (! $recipient || ! filter_var($recipient, FILTER_VALIDATE_EMAIL)) {
                            Log::warning('Booking reminder email skipped because no valid recipient email is available.', [
                                'booking_id' => $booking->booking_id,
                            ]);
                            $failed = true;
                        } else {
                            try {
                                Mail::to($recipient)->send(new BookingReminder($booking));
                                $booking->forceFill(['reminder_sent_at' => now()])->save();
                            } catch (\Throwable $exception) {
                                $failed = true;
                                Log::warning('Booking reminder email failed.', [
                                    'booking_id' => $booking->booking_id,
                                    'error' => $exception->getMessage(),
                                ]);
                            }
                        }
                    }

                    if ($smsEnabled && $booking->reminder_sms_sent_at === null) {
                        try {
                            app(BrevoSmsSender::class)->sendBookingReminder($booking);
                            $booking->forceFill(['reminder_sms_sent_at' => now()])->save();
                        } catch (\Throwable $exception) {
                            $failed = true;
                            Log::warning('Booking reminder SMS failed.', [
                                'booking_id' => $booking->booking_id,
                                'error' => $exception->getMessage(),
                            ]);
                        }
                    }
                }
            }, 'booking_id');

        return $failed ? self::FAILURE : self::SUCCESS;
    }
}
