<?php

namespace App\Services;

use App\Models\SpecialEventTemplate;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class SpecialEventReservationSeeder
{
    private const PURPOSE = 'Annual Community Festival / Official Event';

    public function run(): void
    {
        $systemUserId = $this->systemUserId();
        if (! $systemUserId) {
            return;
        }

        $this->seedDefaultTemplates();

        SpecialEventTemplate::query()
            ->orderBy('id')
            ->get()
            ->each(fn (SpecialEventTemplate $template) => $this->syncTemplate($template, userId: $systemUserId));
    }

    public function syncTemplate(
        SpecialEventTemplate $template,
        bool $replaceUpcoming = false,
        ?int $userId = null,
        bool $rejectConflicts = false
    ): void {
        $userId ??= $this->systemUserId();
        if (! $userId) {
            throw new RuntimeException('No active user is available to own special event reservations.');
        }

        if ($replaceUpcoming) {
            DB::table('booking_request')
                ->where('special_event_template_id', $template->id)
                ->where('start_date', '>=', now('Asia/Manila')->toDateString())
                ->delete();
        }

        $resourceIds = array_values(array_unique(array_map('intval', $template->resource_ids ?? [])));
        if ($resourceIds === []) {
            return;
        }

        $currentYear = now('Asia/Manila')->year;
        $today = now('Asia/Manila')->toDateString();

        for ($year = max($currentYear, (int) $template->start_year); $year <= $currentYear + 1; $year++) {
            $start = $this->annualDate($year, (int) $template->start_month, (int) $template->start_day);
            $end = $this->annualDate($year, (int) $template->end_month, (int) $template->end_day);

            foreach (CarbonPeriod::create($start, $end) as $date) {
                $day = $date->toDateString();
                foreach ($resourceIds as $resourceId) {
                    $existing = DB::table('booking_request')
                        ->where('resource_id', $resourceId)
                        ->where('start_date', $day)
                        ->where('full_name', $template->name)
                        ->where('is_special_event', true)
                        ->whereNull('deleted_at')
                        ->first();

                    if ($existing) {
                        if (! $existing->special_event_template_id) {
                            DB::table('booking_request')
                                ->where('booking_id', $existing->booking_id)
                                ->update(['special_event_template_id' => $template->id]);
                        }
                        continue;
                    }

                    if ($day < $today) {
                        continue;
                    }

                    if ($rejectConflicts && $this->hasBookingConflict($resourceId, $day, (int) $template->id)) {
                        throw ValidationException::withMessages([
                            'resource_ids' => [
                                "Resource {$resourceId} already has a pending or approved booking on {$day}.",
                            ],
                        ]);
                    }

                    DB::table('booking_request')->insert([
                        'user_id' => $userId,
                        'resource_id' => $resourceId,
                        'full_name' => $template->name,
                        'purpose' => self::PURPOSE,
                        'start_date' => $day,
                        'end_date' => $day,
                        'start_time' => '07:00:00',
                        'end_time' => '17:00:00',
                        'status' => 'approved',
                        'is_special_event' => true,
                        'special_event_template_id' => $template->id,
                        'created_at' => now(),
                    ]);
                }
            }
        }
    }

    private function hasBookingConflict(int $resourceId, string $day, int $templateId): bool
    {
        $bookingIds = Schema::hasTable('booking_vehicles')
            ? DB::table('booking_vehicles')
                ->where('resource_id', $resourceId)
                ->select('booking_id')
            : null;

        return DB::table('booking_request')
            ->whereIn('status', ['pending', 'approved'])
            ->whereNull('deleted_at')
            ->where('start_date', '<=', $day)
            ->where('end_date', '>=', $day)
            ->where(function ($query) {
                $query->whereNull('start_time')->orWhere('start_time', '<', '17:00:00');
            })
            ->where(function ($query) {
                $query->whereNull('end_time')->orWhere('end_time', '>', '07:00:00');
            })
            ->where(function ($query) use ($resourceId, $bookingIds) {
                $query->where('resource_id', $resourceId);
                if ($bookingIds !== null) {
                    $query->orWhereIn('booking_id', $bookingIds);
                }
            })
            ->where(function ($query) use ($templateId) {
                $query->whereNull('special_event_template_id')
                    ->orWhere('special_event_template_id', '<>', $templateId);
            })
            ->exists();
    }

    private function seedDefaultTemplates(): void
    {
        if (DB::table('special_event_templates')->exists()) {
            return;
        }

        $currentYear = now('Asia/Manila')->year;
        $festivalYear = $currentYear === 2026 ? 2027 : $currentYear;

        $templates = [
            [
                'name' => 'Sumayajaw Festival',
                'year' => $festivalYear,
                'start_month' => 8,
                'start_day' => 11,
                'end_month' => 8,
                'end_day' => 13,
                'resources' => ['Mini-Bus', 'Cargo Truck', 'Municipal Gymnasium'],
            ],
            [
                'name' => 'Sumayajaw Festival',
                'year' => $festivalYear,
                'start_month' => 8,
                'start_day' => 14,
                'end_month' => 8,
                'end_day' => 15,
                'resources' => ['Cargo Truck', 'Municipal Gymnasium'],
            ],
            [
                'name' => 'Araw ng Habongan',
                'year' => $currentYear,
                'start_month' => 7,
                'start_day' => 1,
                'end_month' => 7,
                'end_day' => 1,
                'resources' => ['Mini-Bus', 'Municipal Gymnasium'],
            ],
            [
                'name' => 'Elementary Alumni',
                'year' => $currentYear,
                'start_month' => 8,
                'start_day' => 16,
                'end_month' => 8,
                'end_day' => 16,
                'resources' => ['Mini-Bus', 'Municipal Gymnasium'],
            ],
            [
                'name' => 'High School Alumni',
                'year' => $currentYear,
                'start_month' => 10,
                'start_day' => 31,
                'end_month' => 10,
                'end_day' => 31,
                'resources' => ['Mini-Bus', 'Cargo Truck', 'Municipal Gymnasium'],
            ],
        ];

        foreach ($templates as $template) {
            $resourceIds = collect($template['resources'])
                ->flatMap(fn (string $name) => $this->resourceIds($name))
                ->unique()
                ->values()
                ->all();

            DB::table('special_event_templates')->insert([
                'name' => $template['name'],
                'start_year' => $template['year'],
                'start_month' => $template['start_month'],
                'start_day' => $template['start_day'],
                'end_month' => $template['end_month'],
                'end_day' => $template['end_day'],
                'resource_ids' => json_encode($resourceIds),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function systemUserId(): ?int
    {
        $activeUsers = function () {
            $users = DB::table('users');
            if (Schema::hasColumn('users', 'deleted_at')) {
                $users->whereNull('deleted_at');
            }

            return $users;
        };

        return $activeUsers()->where('email', 'mayors.office@system.local')->value('user_id')
            ?? $activeUsers()->where('role', 'admin')->orderBy('user_id')->value('user_id')
            ?? $activeUsers()->orderBy('user_id')->value('user_id');
    }

    private function resourceIds(string $name): array
    {
        $query = DB::table('resources')
            ->whereRaw('LOWER(name) = ?', [strtolower(trim($name))]);
        if (Schema::hasColumn('resources', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        $ids = $query->orderBy('resource_id')->pluck('resource_id')->all();
        if ($ids !== []) {
            return array_map('intval', $ids);
        }

        $query = DB::table('resources')
            ->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower(trim($name)).'%']);
        if (Schema::hasColumn('resources', 'deleted_at')) {
            $query->whereNull('deleted_at');
        }

        return array_map('intval', $query->orderBy('resource_id')->pluck('resource_id')->all());
    }

    private function annualDate(int $year, int $month, int $day): string
    {
        $lastDay = Carbon::create($year, $month, 1)->daysInMonth;

        return sprintf('%04d-%02d-%02d', $year, $month, min($day, $lastDay));
    }
}
