<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // 1. Run user accounts seeder first
        $this->call(BarangayAndAdminSeeder::class);

        // 2. Insert resources (Facilities & Vehicles)
        DB::table('resources')->insert([
            // --- Original Facilities ---
            [
                'name' => 'Municipal Gymnasium',
                'type' => 'facility',
                'description' => 'Large indoor venue for community events and sports.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Barangay Conference Room',
                'type' => 'facility',
                'description' => 'Air-conditioned meeting room for official gatherings.',
                'status' => 'available',
                'image' => null,
            ],

            // --- New Facilities Added ---
            [
                'name' => 'Barangay Hall',
                'type' => 'facility',
                'description' => 'Main administrative building for barangay services and meetings.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Barangay Multi-Purpose Hall',
                'type' => 'facility',
                'description' => 'Large hall for community events, assemblies, and sports activities.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Barangay Health Center',
                'type' => 'facility',
                'description' => 'Facility for medical check-ups, vaccinations, and health consultations.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Day Care Centers',
                'type' => 'facility',
                'description' => 'Early childhood education and community care facility.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Materials Recovery Facilities (MRFs)',
                'type' => 'facility',
                'description' => 'Solid waste management, segregation, and recycling center.',
                'status' => 'available',
                'image' => null,
            ],

            // --- Vehicles ---
            [
                'name' => 'Emergency Service Vehicle (Ambulance 1)',
                'type' => 'vehicle',
                'description' => 'Dedicated medical transport vehicle.',
                'status' => 'available',
                'image' => null,
            ],
            [
                'name' => 'Utility Dump Truck',
                'type' => 'vehicle',
                'description' => 'Heavy vehicle for community cleanup and hauling.',
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
                'name' => 'Mini-Bus',
                'type' => 'vehicle',
                'description' => 'Passenger mini-bus for official travel.',
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
                'name' => '2 Dumptruck (6-Wheel)',
                'type' => 'vehicle',
                'description' => '6-wheel utility dump truck fleet.',
                'status' => 'available',
                'image' => null,
            ],
        ]);

        // 3. Run special events & festival bookings seeder last
        $this->call(SpecialEventsSeeder::class);
    }
}
