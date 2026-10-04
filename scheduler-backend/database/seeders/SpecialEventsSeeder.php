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
        // Define the base special events (month and day ranges)
        $events = [
            [
                'title' => 'Sumayajaw Festival',
                'start_month_day' => '08-11',
                'end_month_day' => '08-15',
                'resources' => ['gymnasium', 'Cargo Truck', 'Mini-Bus', 'Man Lift', '2 Dumptruck (6-Wheel)']
            ],
            [
                'title' => 'Elementary Alumni',
                'start_month_day' => '08-16',
                'end_month_day' => '08-16',
                'resources' => ['gymnasium', 'Mini-Bus']
            ],
            [
                'title' => 'Araw ng Habongan',
                'start_month_day' => '07-01',
                'end_month_day' => '07-01',
                'resources' => ['gymnasium', 'Mini-Bus']
            ],
            [
                'title' => 'High School Alumni',
                'start_month_day' => '10-31',
                'end_month_day' => '10-31',
                'resources' => ['gymnasium', 'Cargo Truck', 'Mini-Bus']
            ],
        ];

        $systemUserId = DB::table('users')->where('role', 'admin')->value('user_id') ?? 1;

        // Loop across multiple years (e.g., 2026 to 2030) so annual events repeat every year
        $years = range(2026, 2030);

        foreach ($years as $year) {
            foreach ($events as $event) {
                $startDateStr = "{$year}-{$event['start_month_day']}";
                $endDateStr = "{$year}-{$event['end_month_day']}";

                $period = new DatePeriod(
                    new DateTime($startDateStr),
                    new DateInterval('P1D'),
                    (new DateTime($endDateStr))->modify('+1 day')
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
                                'purpose' => 'Annual Community Festival / Official Event',
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
}
