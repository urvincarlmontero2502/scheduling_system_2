<?php

namespace Database\Seeders;

use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Yearly special events that block resources on the same dates every year.
 * Safe to run many times: rows that already exist are skipped.
 * It fills the current year plus the next YEARS_AHEAD years.
 */
class SpecialEventsSeeder extends Seeder
{
    private const YEARS_AHEAD = 2;
    private const START_TIME = '07:00:00';
    private const END_TIME = '17:00:00';
    private const PURPOSE = 'Annual Community Festival / Official Event';

    public function run(): void
    {
        // Month-day ranges. "2 Dumptruck (6-Wheel)" means 2 units with that name.
        $events = [
            [
                'title' => 'Sumayajaw Festival',
                'start_month_day' => '08-11',
                'end_month_day' => '08-15',
                'resources' => ['gymnasium', 'Cargo Truck', 'Mini-Bus', 'Man Lift', '2 Dumptruck (6-Wheel)'],
            ],
            [
                'title' => 'Elementary Alumni',
                'start_month_day' => '08-16',
                'end_month_day' => '08-16',
                'resources' => ['gymnasium', 'Mini-Bus'],
            ],
            [
                'title' => 'Araw ng Habongan',
                'start_month_day' => '07-01',
                'end_month_day' => '07-01',
                'resources' => ['gymnasium', 'Mini-Bus'],
            ],
            [
                'title' => 'High School Alumni',
                'start_month_day' => '10-31',
                'end_month_day' => '10-31',
                'resources' => ['gymnasium', 'Cargo Truck', 'Mini-Bus'],
            ],
        ];

        $systemUserId = DB::table('users')->where('email', 'mayors.office@system.local')->value('user_id')
            ?? DB::table('users')->where('role', 'admin')->orderBy('user_id')->value('user_id');

        if (!$systemUserId) {
            return; // users not created yet - it will run again on the next start
        }

        $thisYear = (int) Carbon::now()->year;

        foreach (range($thisYear, $thisYear + self::YEARS_AHEAD) as $year) {
            foreach ($events as $event) {
                $period = CarbonPeriod::create(
                    "{$year}-{$event['start_month_day']}",
                    "{$year}-{$event['end_month_day']}"
                );

                foreach ($event['resources'] as $spec) {
                    $resourceIds = $this->resourceIds($spec);

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
    }

    /** Turns "Mini-Bus" or "2 Dumptruck (6-Wheel)" into a list of resource ids. */
    private function resourceIds(string $spec): array
    {
        $count = 1;
        $name = trim($spec);

        if (preg_match('/^(\d+)\s+(.+)$/', $name, $m)) {
            $count = (int) $m[1];
            $name = trim($m[2]);
        }

        // Exact name first, then a "contains" match (e.g. "gymnasium")
        $ids = DB::table('resources')
            ->whereRaw('LOWER(name) = ?', [strtolower($name)])
            ->orderBy('resource_id')
            ->limit($count)
            ->pluck('resource_id')
            ->all();

        if (!$ids) {
            $ids = DB::table('resources')
                ->whereRaw('LOWER(name) LIKE ?', ['%' . strtolower($name) . '%'])
                ->orderBy('resource_id')
                ->limit($count)
                ->pluck('resource_id')
                ->all();
        }

        if (!$ids && strtolower($name) === 'gymnasium') {
            $id = DB::table('resources')->insertGetId([
                'name' => 'Gymnasium',
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
