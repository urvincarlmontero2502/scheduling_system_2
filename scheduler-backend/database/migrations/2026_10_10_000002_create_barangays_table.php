<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Creates a barangays table and seeds it with the 15 default barangays.
// This allows dynamic management of barangays instead of hardcoding them in the frontend.
return new class extends Migration
{
    public function up(): void
    {
        // Check if table already exists (using raw SQL for Supabase reliability)
        $tables = DB::connection()
            ->select("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        $tableNames = array_map(fn($t) => $t->table_name, $tables);

        if (!in_array('barangays', $tableNames)) {
            DB::statement('CREATE TABLE barangays (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL UNIQUE,
                created_at TIMESTAMP NULL,
                updated_at TIMESTAMP NULL
            )');

            // Seed default barangays
            $barangays = [
                'A. Beltran',
                'Baleguian',
                'Bangonay',
                'Bunga',
                'Colorado',
                'Cuyago',
                'Libas',
                'Magdalooc',
                'Magsaysay',
                'Maraiging',
                'Poblacion',
                'San Jose',
                'San Pablo',
                'San Vicente',
                'Santo Nino',
            ];

            foreach ($barangays as $brgy) {
                DB::insert('INSERT INTO barangays (name, created_at, updated_at) VALUES (?, ?, ?)',
                    [$brgy, date('Y-m-d H:i:s'), date('Y-m-d H:i:s')]
                );
            }
        }
    }

    public function down(): void
    {
        DB::statement('DROP TABLE IF EXISTS barangays');
    }
};
