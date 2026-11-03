<?php

namespace Database\Seeders;

use Carbon\Carbon;
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
            ?? DB::table('users')->where('role', 'admin')->orderBy('user_id')->value('user_id');

        if (!$systemUserId) {
            return; // users not created yet - it will run again on the next start
        }

        // Consolidated LGU special events with exact date ranges and resource assignments
        $events = [
            // 1. Sumayajaw Festival 2026 - 2026-08-11 to 2026-08-15 (5 Days)
            [
                'title' => 'Sumayajaw Festival',
                'start_date' => '2026-08-11',
                'end_date' => '2026-08-15',
                'resources' => ['Dumptruck (6-Wheel)', 'Man Lift', 'Mini-Bus', 'Cargo Truck', 'Municipal Gymnasium'],
            ],

            // 2. Araw ng Habongan - 2026-07-01
            [
                'title' => 'Araw ng Habongan',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-01',
                'resources' => ['Mini-Bus', 'Municipal Gymnasium'],
            ],

            // 3. Elementary Alumni - 2026-08-16
            [
                'title' => 'Elementary Alumni',
                'start_date' => '2026-08-16',
                'end_date' => '2026-08-16',
                'resources' => ['Mini-Bus', 'Municipal Gymnasium'],
            ],

            // 4. High School Alumni - 2026-10-31
            [
                'title' => 'High School Alumni',
                'start_date' => '2026-10-31',
                'end_date' => '2026-10-31',
                'resources' => ['Mini-Bus', 'Cargo Truck', 'Municipal Gymnasium'],
            ],

            // 5. Sumayajaw Festival 2027 (Days 1-3) - 2027-08-11 to 2027-08-13
            [
                'title' => 'Sumayajaw Festival',
                'start_date' => '2027-08-11',
                'end_date' => '2027-08-13',
                'resources' => ['Mini-Bus', 'Cargo Truck', 'Municipal Gymnasium'],
            ],

            // 6. Sumayajaw Festival 2027 (Days 4-5) - 2027-08-14 to 2027-08-15
            [
                'title' => 'Sumayajaw Festival',
                'start_date' => '2027-08-14',
                'end_date' => '2027-08-15',
                'resources' => ['Cargo Truck', 'Municipal Gymnasium'],
            ],
        ];

        foreach ($events as $event) {
            $period = CarbonPeriod::create($event['start_date'], $event['end_date']);

            foreach ($event['resources'] as $resourceName) {
                $resourceIds = $this->resourceIds($resourceName);

                foreach ($resourceIds as $resourceId) {
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
                    }
                }
            }
        }
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
        if (!$ids) {
            $ids = DB::table('resources')
                ->whereRaw('LOWER(name) LIKE ?', ['%' . strtolower($name) . '%'])
                ->orderBy('resource_id')
                ->pluck('resource_id')
                ->all();
        }

        // Auto-create Municipal Gymnasium if missing
        if (!$ids && strtolower($name) === 'municipal gymnasium') {
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
