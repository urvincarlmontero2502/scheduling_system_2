<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SpecialEventsSeeder extends Seeder
{
    public function run()
    {
        // Define the special events with their date ranges and resource names
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

        // Find an admin or system user ID to attribute these official bookings to
        $systemUserId = DB::table('users')->where('role', 'admin')->value('user_id') ?? 1;

        foreach ($events as $event) {
            foreach ($event['resources'] as $resourceName) {
                // Look up the resource_id from the resources table
                $resource = DB::table('resources')->where('name', 'LIKE', "%{$resourceName}%")->first();

                if ($resource) {
                    DB::table('booking_request')->insert([
                        'user_id' => $systemUserId,
                        'resource_id' => $resource->resource_id,
                        'full_name' => $event['title'], // Used as event/requester title
                        'purpose' => 'Community Festival / Official Event',
                        'start_date' => $event['start_date'],
                        'end_date' => $event['end_date'],
                        'start_time' => '07:00:00',
                        'end_time' => '17:00:00',
                        'status' => 'approved', // Automatically approved so it blocks the calendar
                        'created_at' => now(),
                    ]);
                }
            }
        }
    }
}
