<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use DatePeriod;
use DateTime;
use DateInterval;

class SpecialEventsSeeder extends Seeder
{
    public function run()
    {
        $events = [
            [
                'title' => 'Sumayajaw Festival',
                'start_date' => '2026-08-11',
                'end_date' => '2026-08-15',
                'resources' => ['gymnasium', 'Cargo Truck', 'Mini-Bus', 'Man Lift', '2 Dumptruck (6-Wheel)']
            ],
            [
                'title' => 'Elementary Alumni',
                'start_date' => '2026-08-16',
                'end_date' => '2026-08-16',
                'resources' => ['gymnasium', 'Mini-Bus']
            ],
            [
                'title' => 'Araw ng Habongan',
                'start_date' => '2026-07-01',
                'end_date' => '2026-07-01',
                'resources' => ['gymnasium', 'Mini-Bus']
            ],
            [
                'title' => 'High School Alumni',
                'start_date' => '2026-10-31',
                'end_date' => '2026-10-31',
                'resources' => ['gymnasium', 'Cargo Truck', 'Mini-Bus']
            ],
        ];

        $systemUserId = DB::table('users')->where('role', 'admin')->value('user_id') ?? 1;

        foreach ($events as $event) {
            // Create a date period to loop through every single day of multi-day events
            $period = new DatePeriod(
                new DateTime($event['start_date']),
                new DateInterval('P1D'),
                (new DateTime($event['end_date']))->modify('+1 day')
            );

            foreach ($period as $date) {
                $currentDate = $date->format('Y-m-d');

                foreach ($event['resources'] as $resourceName) {
                    $resource = DB::table('resources')->where('name', 'ILIKE', "%{$resourceName}%")->first();

                    if ($resource) {
                        DB::table('booking_request')->insert([
                            'user_id' => $systemUserId,
                            'resource_id' => $resource->resource_id,
                            'full_name' => $event['title'],
                            'purpose' => 'Community Festival / Official Event',
                            'start_date' => $currentDate,
                            'end_date' => $currentDate,
                            'start_time' => '07:00:00',
                            'end_time' => '17:00:00',
                            'status' => 'approved',
                            'created_at' => now(),
                        ]);
                    }
                }
            }
        }
    }
}
