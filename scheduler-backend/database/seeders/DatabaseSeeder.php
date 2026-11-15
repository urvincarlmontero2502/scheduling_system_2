<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(BarangayAndAdminSeeder::class);

        // 2. Insert resources (Facilities & Vehicles)
        DB::table('resources')->insert([
            // --- Facilities ---
            [
                'name' => 'Municipal Gymnasium',
                'type' => 'facility',
                'description' => 'Large indoor venue for community events and sports.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Multi-Purpose Hall',
                'type' => 'facility',
                'description' => 'Large hall for community events, assemblies, and sports activities.',
                'status' => 'available',
                'image' => null,
            ],

            // --- Vehicles & Heavy Equipment ---
            // 3 Dumptrucks
            [
                'name' => 'Dumptruck (10-Wheel)',
                'type' => 'vehicle',
                'description' => 'Heavy-duty ten-wheeler utility dump truck.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Dumptruck (6-Wheel)',
                'type' => 'vehicle',
                'description' => '6-wheel utility dump truck fleet (Unit 1).',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Dumptruck (6-Wheel)',
                'type' => 'vehicle',
                'description' => '6-wheel utility dump truck fleet (Unit 2).',
                'status' => 'available',
                'image' => null,
            ],

            // Heavy Equipment & Special Trucks
            [
                'name' => 'Backhoe',
                'type' => 'vehicle',
                'description' => 'Heavy excavation and earthmoving equipment.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Payloader',
                'type' => 'vehicle',
                'description' => 'Heavy loader for material handling and clearing.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Bulldozer',
                'type' => 'vehicle',
                'description' => 'Heavy crawler tractor for grading and earthmoving.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Road Roller',
                'type' => 'vehicle',
                'description' => 'Compactor heavy equipment for road construction.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Grader',
                'type' => 'vehicle',
                'description' => 'Motor grader for surface grading and leveling.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Self Load',
                'type' => 'vehicle',
                'description' => 'Specialized self-loading transport truck.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Cargo Truck',
                'type' => 'vehicle',
                'description' => 'Heavy transport cargo truck for community logistics.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Man Lift',
                'type' => 'vehicle',
                'description' => 'Specialized equipment for elevated maintenance tasks.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Mini-Bus',
                'type' => 'vehicle',
                'description' => 'Passenger mini-bus for official travel.',
                'status' => 'available',
                'image' => null,
            ],

            // Ambulances (4 Units)
            [
                'name' => 'Ambulance',
                'type' => 'vehicle',
                'description' => 'Dedicated emergency medical transport unit 1.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Ambulance',
                'type' => 'vehicle',
                'description' => 'Dedicated emergency medical transport unit 2.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Ambulance',
                'type' => 'vehicle',
                'description' => 'Dedicated emergency medical transport unit 3.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Ambulance',
                'type' => 'vehicle',
                'description' => 'Dedicated emergency medical transport unit 4.',
                'status' => 'available',
                'image' => null,
            ],

            // Service Vehicles
            [
                'name' => 'Terra',
                'type' => 'vehicle',
                'description' => 'Official municipal utility and transport vehicle.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Navara',
                'type' => 'vehicle',
                'description' => 'Official pickup truck for field operations.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Hi-Ace (SB Office)',
                'type' => 'vehicle',
                'description' => 'Sangguniang Bayan office transport van.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Hi-Ace (MSWD)',
                'type' => 'vehicle',
                'description' => 'Municipal Social Welfare and Development transport van.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Montero Sports',
                'type' => 'vehicle',
                'description' => 'Official administrative vehicle.',
                'status' => 'available',
                'image' => null,
            ],
        ]);

        // 3. Run special events & festival bookings seeder last
        $this->call(SpecialEventsSeeder::class);
    }
}
