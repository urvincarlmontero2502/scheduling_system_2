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
        return response()->json([
            'days_before' => (int) (DB::table('system_settings')
                ->where('key', self::BOOKING_REMINDER_KEY)
                ->value('value') ?? 1),
        ]);
    }

    public function updateBookingReminder(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'days_before' => ['required', 'integer', 'in:1,3,5'],
        ]);

        DB::table('system_settings')->upsert(
            [[
                'key' => self::BOOKING_REMINDER_KEY,
                'value' => (string) $validated['days_before'],
                'created_at' => now(),
                'updated_at' => now(),
            ]],
            ['key'],
            ['value', 'updated_at']
        );

        return response()->json([
            'message' => 'Booking reminder setting saved.',
            'days_before' => (int) $validated['days_before'],
        ]);
    }
}
