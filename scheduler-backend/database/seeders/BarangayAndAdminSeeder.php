<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\User;
use Illuminate\Support\Facades\Hash;

class BarangayAndAdminSeeder extends Seeder
{
    public function run(): void
    {
        $tempPassword = Hash::make('Password123!');

        // 1. Create Mayor's Office Admin Account
        User::updateOrCreate(
            ['email' => 'mayors.office@system.local'],
            [
                'full_name' => "Mayor's Office",
                'password_hash' => $tempPassword,
                'role' => 'admin',
                'barangay' => null,
            ]
        );

        // 2. List of the 15 Barangays (replacing ñ with n for clean emails)
        $barangays = [
            'A. Beltran',
            'Baleguian',
            'Bangonay',
            'Bunga',
            'Colorado',
            'Cuyago',
            'Libas',
            'Magdagooc',
            'Magsaysay',
            'Maraiging',
            'Poblacion',
            'San Jose',
            'San Pablo',
            'San Vicente',
            'Santo Nino', // Changed from Santo Niño
        ];

        // 3. Loop and create individual accounts for each barangay
        //    Poblacion is special: its admin is a barangay_admin who can approve/reject
        //    registration requests. Others are regular staff (user role).
        foreach ($barangays as $brgy) {
            // Generate a clean email handle (e.g., "a.beltran@system.local")
            $slug = strtolower(str_replace(['.', ' '], ['', ''], $brgy));

            // Poblacion gets barangay_admin role so it can manage registration requests
            $role = ($brgy === 'Poblacion') ? 'barangay_admin' : 'user';

            User::updateOrCreate(
                ['email' => "{$slug}@system.local"],
                [
                    'full_name' => "{$brgy} Representative",
                    'password_hash' => $tempPassword,
                    'role' => $role,
                    'barangay' => $brgy,
                ]
            );
        }
    }
}
