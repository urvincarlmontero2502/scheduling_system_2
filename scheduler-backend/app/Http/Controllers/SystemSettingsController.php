<?php

namespace App\Http\Controllers;

use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Throwable;

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

    /**
     * Admin-only storage diagnostic: writes, reads, checks the public URL of,
     * and deletes a small test file on the "assets" disk. Never returns secrets.
     */
    public function storageCheck(Request $request): JsonResponse
    {
        $disk = 'assets';
        $cfg = config('filesystems.disks.assets', []);
        $driver = $cfg['driver'] ?? 'local';

        // Read from config (not env()): env() returns null once config is cached.
        $required = [
            'ASSETS_DRIVER' => ! empty($cfg['driver']),
            'SUPABASE_S3_ACCESS_KEY_ID' => ! empty($cfg['key']),
            'SUPABASE_S3_SECRET_ACCESS_KEY' => ! empty($cfg['secret']),
            'SUPABASE_S3_REGION' => ! empty($cfg['region']),
            'SUPABASE_S3_BUCKET' => ! empty($cfg['bucket']),
            'SUPABASE_S3_ENDPOINT' => ! empty($cfg['endpoint']),
            'SUPABASE_STORAGE_PUBLIC_URL' => ! empty($cfg['url']),
        ];

        $missing = [];
        if ($driver === 's3') {
            $missing = array_keys(array_filter($required, fn ($present) => ! $present));
        }
        $envOk = $driver !== 's3' || count($missing) === 0;

        $testPath = 'diagnostics/check-'.time().'.txt';
        $testContent = 'storage_test_'.time();

        $writeOk = false;
        $readOk = false;
        $deleteOk = false;
        $publicUrlOk = false;
        $publicUrlStatus = null;
        $hints = [];

        if (! $envOk) {
            $hints[] = 'Missing settings in Render: '.implode(', ', $missing).'.';
        }

        try {
            $writeOk = (bool) Storage::disk($disk)->put($testPath, $testContent);
        } catch (Throwable $e) {
            $hints[] = $this->describe('Write', $e);
            $hints[] = $this->hintFor($e);
        }

        if ($writeOk) {
            try {
                $readOk = Storage::disk($disk)->get($testPath) === $testContent;
            } catch (Throwable $e) {
                $hints[] = $this->describe('Read', $e);
            }

            try {
                $publicUrl = Storage::disk($disk)->url($testPath);
                if ($publicUrl) {
                    $response = Http::timeout(5)->head($publicUrl);
                    $publicUrlStatus = $response->status();
                    $publicUrlOk = $response->successful();
                    if (! $publicUrlOk) {
                        $hints[] = 'The file was saved but its public address returned '.$publicUrlStatus
                            .'. Make the bucket Public in Supabase, or fix SUPABASE_STORAGE_PUBLIC_URL '
                            .'(try https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>).';
                    }
                }
            } catch (Throwable $e) {
                $hints[] = $this->describe('Public URL check', $e);
            }

            try {
                $deleteOk = (bool) Storage::disk($disk)->delete($testPath);
            } catch (Throwable $e) {
                $hints[] = $this->describe('Delete', $e);
            }
        }

        return response()->json([
            'driver' => $driver,
            'env_ok' => $envOk,
            'missing' => $missing,
            'write_ok' => $writeOk,
            'read_ok' => $readOk,
            'delete_ok' => $deleteOk,
            'public_url_ok' => $publicUrlOk,
            'public_url_status' => $publicUrlStatus,
            'hints' => array_values(array_filter($hints)),
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

    /** One safe line: error class, AWS error code if any, and a trimmed message with keys removed. */
    private function describe(string $step, Throwable $e): string
    {
        $code = $this->awsErrorCode($e);
        $message = $e->getMessage();

        foreach ([config('filesystems.disks.assets.key'), config('filesystems.disks.assets.secret')] as $secret) {
            if (! empty($secret)) {
                $message = str_replace($secret, '[hidden]', $message);
            }
        }

        $message = preg_split('/\R/', $message)[0] ?? $message;

        return sprintf(
            '%s failed: %s%s: %s',
            $step,
            class_basename($e),
            $code ? ' ['.$code.']' : '',
            mb_substr($message, 0, 200)
        );
    }

    private function hintFor(Throwable $e): string
    {
        $code = (string) $this->awsErrorCode($e);
        $text = $e->getMessage();

        if (in_array($code, ['SignatureDoesNotMatch', 'InvalidAccessKeyId'], true)
            || str_contains($text, 'SignatureDoesNotMatch')
            || str_contains($text, 'InvalidAccessKeyId')
            || str_contains($text, '403')) {
            return 'Wrong access key or secret (or the key is not allowed on this bucket). Create a new S3 access key in Supabase and update Render.';
        }

        if ($code === 'NoSuchBucket' || str_contains($text, 'NoSuchBucket')) {
            return 'Bucket not found. Check SUPABASE_S3_BUCKET and SUPABASE_S3_ENDPOINT.';
        }

        return 'Check SUPABASE_S3_ENDPOINT, SUPABASE_S3_REGION and SUPABASE_S3_USE_PATH_STYLE_ENDPOINT=true.';
    }

    private function awsErrorCode(Throwable $e): ?string
    {
        for ($x = $e; $x !== null; $x = $x->getPrevious()) {
            if ($x instanceof \Aws\Exception\AwsException && $x->getAwsErrorCode()) {
                return (string) $x->getAwsErrorCode();
            }
        }

        return null;
    }
}
