<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SystemSettingsController extends Controller
{
    private const BOOKING_REMINDER_KEY = 'booking_reminder_days_before';

    public function showBookingReminder(): JsonResponse
    {
        $settings = DB::table('system_settings')
            ->whereIn('key', [self::BOOKING_REMINDER_KEY, 'booking_reminder_sms_enabled'])
            ->pluck('value', 'key');

        return response()->json([
            'days_before' => (int) (DB::table('system_settings')
                ->where('key', self::BOOKING_REMINDER_KEY)
                ->value('value') ?? 1),
            'sms_enabled' => $settings->get('booking_reminder_sms_enabled') === '1',
        ]);
    }

    public function updateBookingReminder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days_before' => ['required', 'integer', 'in:1,3,5'],
            'sms_enabled' => ['sometimes', 'boolean'],
        ]);

        $settings = [
            self::BOOKING_REMINDER_KEY => (string) $validated['days_before'],
        ];
        if (array_key_exists('sms_enabled', $validated)) {
            $settings['booking_reminder_sms_enabled'] = $validated['sms_enabled'] ? '1' : '0';
        }

        foreach ($settings as $key => $value) {
            DB::table('system_settings')->upsert(
                [[
                    'key' => $key,
                    'value' => $value,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]],
                ['key'],
                ['value', 'updated_at']
            );
        }

        $settings = DB::table('system_settings')
            ->whereIn('key', [self::BOOKING_REMINDER_KEY, 'booking_reminder_sms_enabled'])
            ->pluck('value', 'key');

        return response()->json([
            'message' => 'Booking reminder setting saved.',
            'days_before' => (int) $settings->get(self::BOOKING_REMINDER_KEY, 1),
            'sms_enabled' => $settings->get('booking_reminder_sms_enabled') === '1',
        ]);
    }
}
