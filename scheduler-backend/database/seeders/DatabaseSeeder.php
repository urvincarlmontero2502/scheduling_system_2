<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(BarangayAndAdminSeeder::class);

        DB::table('resources')->insert([
            [
                'name' => 'Municipal Gymnasium',
                'type' => 'facility',
                'description' => 'Large indoor venue for community events and sports.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Barangay Conference Room',
                'type' => 'facility',
                'description' => 'Air-conditioned meeting room for official gatherings.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Emergency Service Vehicle (Ambulance 1)',
                'type' => 'vehicle',
                'description' => 'Dedicated medical transport vehicle.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Utility Dump Truck',
                'type' => 'vehicle',
                'description' => 'Heavy vehicle for community cleanup and hauling.',
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }
}
