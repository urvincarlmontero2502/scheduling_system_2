<?php

namespace App\Http\Controllers;

use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

use Throwable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;

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

    public function storageCheck(Request $request): JsonResponse
    {
        $disk = 'assets';
        $driver = config('filesystems.disks.assets.driver', 'local');

        $requiredEnvs = [
            'ASSETS_DRIVER' => ! empty(env('ASSETS_DRIVER')),
            'SUPABASE_S3_ACCESS_KEY_ID' => ! empty(env('SUPABASE_S3_ACCESS_KEY_ID')),
            'SUPABASE_S3_SECRET_ACCESS_KEY' => ! empty(env('SUPABASE_S3_SECRET_ACCESS_KEY')),
            'SUPABASE_S3_REGION' => ! empty(env('SUPABASE_S3_REGION')),
            'SUPABASE_S3_BUCKET' => ! empty(env('SUPABASE_S3_BUCKET')),
            'SUPABASE_S3_ENDPOINT' => ! empty(env('SUPABASE_S3_ENDPOINT')),
            'SUPABASE_STORAGE_PUBLIC_URL' => ! empty(env('SUPABASE_STORAGE_PUBLIC_URL')),
        ];

        $envOk = true;
        if ($driver === 's3') {
            foreach ($requiredEnvs as $present) {
                if (! $present) {
                    $envOk = false;
                    break;
                }
            }
        }

        $testPath = 'diagnostics/check-'.time().'.txt';
        $testContent = 'storage_test_'.time();

        $writeOk = false;
        $readOk = false;
        $deleteOk = false;
        $publicUrlOk = false;
        $publicUrlStatus = null;
        $hints = [];
        $errorDetails = null;

        try {
            $writeOk = Storage::disk($disk)->put($testPath, $testContent);
        } catch (Throwable $e) {
            $errorDetails = class_basename($e).': '.$e->getMessage();
            if (str_contains($e->getMessage(), '403') || str_contains($e->getMessage(), 'SignatureDoesNotMatch')) {
                $hints[] = '403 or SignatureDoesNotMatch means wrong access key or secret.';
            } elseif (str_contains($e->getMessage(), 'NoSuchBucket')) {
                $hints[] = 'NoSuchBucket means wrong bucket name or endpoint.';
            } else {
                $hints[] = 'Write failed: '.$errorDetails;
            }
        }

        if ($writeOk) {
            try {
                $retrieved = Storage::disk($disk)->get($testPath);
                $readOk = ($retrieved === $testContent);
            } catch (Throwable $e) {
                $hints[] = 'Read failed: '.class_basename($e).': '.$e->getMessage();
            }

            try {
                $publicUrl = Storage::disk($disk)->url($testPath);
                if ($publicUrl) {
                    try {
                        $response = Http::timeout(5)->head($publicUrl);
                        $publicUrlStatus = $response->status();
                        if ($response->successful()) {
                            $publicUrlOk = true;
                        } else {
                            $hints[] = 'public_url_ok=false with '.$publicUrlStatus.' means the bucket is not public or SUPABASE_STORAGE_PUBLIC_URL is wrong.';
                        }
                    } catch (Throwable $e) {
                        $hints[] = 'HEAD request failed: '.class_basename($e).': '.$e->getMessage();
                    }
                }
            } catch (Throwable $e) {
                $hints[] = 'URL build failed: '.class_basename($e).': '.$e->getMessage();
            }

            try {
                $deleteOk = Storage::disk($disk)->delete($testPath);
            } catch (Throwable $e) {
                $hints[] = 'Delete failed: '.class_basename($e).': '.$e->getMessage();
            }
        }

        return response()->json([
            'driver' => $driver,
            'env_ok' => $envOk,
            'write_ok' => $writeOk,
            'read_ok' => $readOk,
            'delete_ok' => $deleteOk,
            'public_url_ok' => $publicUrlOk,
            'public_url_status' => $publicUrlStatus,
            'hints' => $hints,
        ]);
    }

    public function updateBookingReminder(Request $request): JsonResponse
    {
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
        $smsEnabled = $settings->get('booking_reminder_sms_enabled') === '1';

        app(ActivityLogger::class)->record(
            $request->user(),
            'settings.booking_reminder_updated',
            sprintf(
                'Updated booking reminders: %s day(s) before; SMS %s.',
                $validated['days_before'],
                $smsEnabled ? 'enabled' : 'disabled'
            ),
            'system_setting',
            self::BOOKING_REMINDER_KEY,
            [
                'days_before' => (int) $validated['days_before'],
                'sms_enabled' => $smsEnabled,
            ]
        );

        return response()->json([
            'message' => 'Booking reminder setting saved.',
            'days_before' => (int) $settings->get(self::BOOKING_REMINDER_KEY, 1),
            'sms_enabled' => $settings->get('booking_reminder_sms_enabled') === '1',
        ]);
    }
}
