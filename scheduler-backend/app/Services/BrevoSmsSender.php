<?php

namespace App\Services;

use App\Models\BookingRequest;
use Carbon\Carbon;
use Symfony\Component\HttpClient\NativeHttpClient;
use Symfony\Contracts\HttpClient\Exception\TransportExceptionInterface;
use Symfony\Contracts\HttpClient\HttpClientInterface;

class BrevoSmsSender
{
    public function __construct(private ?HttpClientInterface $client = null) {}

    public function sendBookingReminder(BookingRequest $booking): void
    {
        $apiKey = config('services.brevo.key');
        $sender = config('services.brevo.sms_sender');
        $recipient = $this->normalizePhilippineNumber($booking->cell_number);

        if (! is_string($apiKey) || trim($apiKey) === '') {
            throw new \RuntimeException('BREVO_API_KEY is not configured.');
        }

        if (! is_string($sender) || ! preg_match('/^(?:[A-Za-z0-9]{1,11}|[0-9]{12,15})$/', $sender)) {
            throw new \RuntimeException('BREVO_SMS_SENDER must be a valid Brevo SMS sender name.');
        }

        if ($recipient === null) {
            throw new \RuntimeException('The booking does not have a valid Philippine mobile number.');
        }

        $date = Carbon::parse($booking->start_date)->format('M j, Y');
        $time = $booking->start_time && $booking->end_time
            ? ' at '.substr($booking->start_time, 0, 5)
            : '';
        $reference = $booking->reference_id ? ' Ref '.$booking->reference_id.'.' : '';
        $content = "Jabonga Scheduler: Reminder: your booking starts on {$date}{$time}.{$reference}";

        $client = $this->client ?? new NativeHttpClient(['timeout' => 15]);
        $response = $client->request('POST', 'https://api.brevo.com/v3/transactionalSMS/sms', [
            'headers' => [
                'api-key' => $apiKey,
                'accept' => 'application/json',
            ],
            'json' => [
                'sender' => $sender,
                'recipient' => $recipient,
                'content' => $content,
                'type' => 'transactional',
                'unicodeEnabled' => false,
                'tag' => 'booking-reminder',
            ],
        ]);

        try {
            $statusCode = $response->getStatusCode();
            $body = $response->getContent(false);
        } catch (TransportExceptionInterface $exception) {
            throw new \RuntimeException('Could not reach the Brevo SMS API.', 0, $exception);
        }

        if ($statusCode !== 201) {
            throw new \RuntimeException(sprintf(
                'Brevo SMS API returned HTTP %d: %s',
                $statusCode,
                $body
            ));
        }
    }

    private function normalizePhilippineNumber(?string $phone): ?string
    {
        if (! is_string($phone) || trim($phone) === '') {
            return null;
        }

        $trimmed = trim($phone);
        $digits = preg_replace('/\D+/', '', $trimmed);

        if (str_starts_with($trimmed, '+63')) {
            $national = substr($digits, 2);
        } elseif (str_starts_with($digits, '0063')) {
            $national = substr($digits, 4);
        } elseif (str_starts_with($digits, '63')) {
            $national = substr($digits, 2);
        } elseif (str_starts_with($digits, '09')) {
            $national = substr($digits, 1);
        } elseif (preg_match('/^9\d{9}$/', $digits)) {
            $national = $digits;
        } else {
            return null;
        }

        if (! preg_match('/^9\d{9}$/', $national)) {
            return null;
        }

        return '+63'.$national;
    }
}
