<?php

namespace Database\Seeders;

use Carbon\CarbonPeriod;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * LGU Special Events & Festival Resource Reservations.
 * Seeds exact date ranges and resource assignments per official LGU calendar.
 * Safe to run many times: rows that already exist are skipped.
 */
class SpecialEventsSeeder extends Seeder
{
    private const START_TIME = '07:00:00';

    private const END_TIME = '17:00:00';

    private const PURPOSE = 'Annual Community Festival / Official Event';

    public function run(): void
    {
        $systemUserId = DB::table('users')->where('email', 'mayors.office@system.local')->value('user_id')
            ?? DB::table('users')->where('role', 'admin')->orderBy('user_id')->value('user_id')
            ?? DB::table('users')->orderBy('user_id')->value('user_id');

        if (! $systemUserId) {
            $this->command?->warn('Special events skipped: no users exist yet. They will be seeded on the next boot.');

            return;
        }

        $inserted = 0;

        foreach ($this->annualEvents() as $event) {
            $period = CarbonPeriod::create($event['start_date'], $event['end_date']);

            foreach ($event['resources'] as $resourceName) {
                foreach ($this->resourceIds($resourceName) as $resourceId) {
                    foreach ($period as $date) {
                        $day = $date->toDateString();

                        $exists = DB::table('booking_request')
                            ->where('resource_id', $resourceId)
                            ->where('start_date', $day)
                            ->where('full_name', $event['title'])
                            ->exists();

                        if ($exists) {
                            continue;
                        }

                        DB::table('booking_request')->insert([
                            'user_id' => $systemUserId,
                            'resource_id' => $resourceId,
                            'full_name' => $event['title'],
                            'purpose' => self::PURPOSE,
                            'start_date' => $day,
                            'end_date' => $day,
                            'start_time' => self::START_TIME,
                            'end_time' => self::END_TIME,
                            'status' => 'approved',
                            'is_special_event' => true,
                            'created_at' => now(),
                        ]);
                        $inserted++;
                    }
                }
            }
        }

        $this->command?->info("Special events seed finished. Inserted {$inserted} booking rows (existing rows were skipped).");
    }

    /**
     * Seed the current and following year. The scheduled yearly run keeps
     * extending the reservations without creating distant bookings too early.
     */
    private function annualEvents(): array
    {
        $currentYear = now('Asia/Manila')->year;
        $events = [];

        for ($year = $currentYear; $year <= $currentYear + 1; $year++) {
            if ($year === 2026) {
                $events[] = [
                    'title' => 'Sumayajaw Festival',
                    'start_date' => $this->annualDate($year, 8, 11),
                    'end_date' => $this->annualDate($year, 8, 15),
                    'resources' => ['Dumptruck (6-Wheel)', 'Man Lift', 'Mini-Bus', 'Cargo Truck', 'Municipal Gymnasium'],
                ];
            } else {
                $events[] = [
                    'title' => 'Sumayajaw Festival',
                    'start_date' => $this->annualDate($year, 8, 11),
                    'end_date' => $this->annualDate($year, 8, 13),
                    'resources' => ['Mini-Bus', 'Cargo Truck', 'Municipal Gymnasium'],
                ];
                $events[] = [
                    'title' => 'Sumayajaw Festival',
                    'start_date' => $this->annualDate($year, 8, 14),
                    'end_date' => $this->annualDate($year, 8, 15),
                    'resources' => ['Cargo Truck', 'Municipal Gymnasium'],
                ];
            }

            $events[] = [
                'title' => 'Araw ng Habongan',
                'start_date' => $this->annualDate($year, 7, 1),
                'end_date' => $this->annualDate($year, 7, 1),
                'resources' => ['Mini-Bus', 'Municipal Gymnasium'],
            ];
            $events[] = [
                'title' => 'Elementary Alumni',
                'start_date' => $this->annualDate($year, 8, 16),
                'end_date' => $this->annualDate($year, 8, 16),
                'resources' => ['Mini-Bus', 'Municipal Gymnasium'],
            ];
            $alumniDate = $this->annualDate($year, 10, 31);
            $events[] = [
                'title' => 'High School Alumni',
                'start_date' => $alumniDate,
                'end_date' => $alumniDate,
                'resources' => ['Mini-Bus', 'Cargo Truck', 'Municipal Gymnasium'],
            ];
        }

        return $events;
    }

    /**
     * Resolve a recurring month/day, backing up to the month's final valid day
     * if a configured day does not exist in that year.
     */
    private function annualDate(int $year, int $month, int $day): string
    {
        $lastDay = cal_days_in_month(CAL_GREGORIAN, $month, $year);

        return sprintf('%04d-%02d-%02d', $year, $month, min($day, $lastDay));
    }

    /** Turns resource name into a list of resource IDs (exact match first, then fuzzy). */
    private function resourceIds(string $name): array
    {
        $name = trim($name);

        // Exact name match first
        $ids = DB::table('resources')
            ->whereRaw('LOWER(name) = ?', [strtolower($name)])
            ->orderBy('resource_id')
            ->pluck('resource_id')
            ->all();

        // Fuzzy match if exact not found
        if (! $ids) {
            $ids = DB::table('resources')
                ->whereRaw('LOWER(name) LIKE ?', ['%'.strtolower($name).'%'])
                ->orderBy('resource_id')
                ->pluck('resource_id')
                ->all();
        }

        // Auto-create Municipal Gymnasium if missing
        if (! $ids && strtolower($name) === 'municipal gymnasium') {
            $id = DB::table('resources')->insertGetId([
                'name' => 'Municipal Gymnasium',
                'type' => 'facility',
                'status' => 'available',
                'description' => 'Large indoor venue for community events and sports.',
            ], 'resource_id');

            DB::table('facility_details')->insert([
                'resource_id' => $id,
                'amenities' => 'Standard facility amenities',
            ]);

            $ids = [$id];
        }

        return array_map('intval', $ids);
    }
}
