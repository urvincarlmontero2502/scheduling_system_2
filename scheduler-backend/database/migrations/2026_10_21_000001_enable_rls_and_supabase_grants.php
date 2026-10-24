<?php

use Illuminate\Support\Facades\DB;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Enable Row-Level Security on all tables in the public schema.
        // This prevents unauthenticated access via Supabase Data API / PostgREST.
        $tables = [
            'users',
            'resources',
            'facility_details',
            'vehicle_details',
            'booking_request',
            'approval',
            'notifications',
            'barangays',
            'google_oauth_temp_tokens',
            'asset_logs',
            'migrations',
            'cache',
            'jobs',
        ];

        foreach ($tables as $table) {
            // Enable RLS
            DB::statement("ALTER TABLE {$table} ENABLE ROW LEVEL SECURITY;");

            // Create policies that allow authenticated users (via service_role)
            // to read/write. The app uses Laravel Sanctum Bearer tokens, so
            // access is controlled at the application layer, not Supabase Auth.
            DB::statement("
                CREATE POLICY \"Allow authenticated read/write\"
                ON {$table}
                FOR ALL
                TO authenticated, service_role
                USING (true)
                WITH CHECK (true);
            ");

            // Allow anon read-only on non-sensitive tables
            $anonReadTables = ['barangays'];
            if (in_array($table, $anonReadTables)) {
                DB::statement("
                    CREATE POLICY \"Allow anon read\"
                    ON {$table}
                    FOR SELECT
                    TO anon
                    USING (true);
                ");
            }
        }

        // Explicitly grant privileges to roles
        // Required for PostgREST / Supabase JS client access (post-Oct 30)
        foreach ($tables as $table) {
            DB::statement("GRANT SELECT ON {$table} TO anon;");
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO authenticated;");
            DB::statement("GRANT SELECT, INSERT, UPDATE, DELETE ON {$table} TO service_role;");
        }
    }

    public function down(): void
    {
        $tables = [
            'users',
            'resources',
            'facility_details',
            'vehicle_details',
            'booking_request',
            'approval',
            'notifications',
            'barangays',
            'google_oauth_temp_tokens',
            'asset_logs',
            'migrations',
            'cache',
            'jobs',
        ];

        foreach ($tables as $table) {
            DB::statement("DROP POLICY IF EXISTS \"Allow authenticated read/write\" ON {$table};");
            DB::statement("DROP POLICY IF EXISTS \"Allow anon read\" ON {$table};");
            DB::statement("ALTER TABLE {$table} DISABLE ROW LEVEL SECURITY;");
        }
    }
};
