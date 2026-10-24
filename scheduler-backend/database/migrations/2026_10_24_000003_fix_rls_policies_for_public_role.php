<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Fix RLS policies to include the 'public' role.
 *
 * The initial RLS migration (2026_10_21_000001) only granted access to
 * 'authenticated' and 'service_role' roles. However, the Laravel application
 * connects to Supabase PostgreSQL using a database username/password that
 * maps to the 'public' role, NOT 'service_role'. This caused RLS to block
 * all reads/writes from the Laravel app, resulting in:
 * - Temporary OAuth tokens not being found (400 "Invalid or expired registration token")
 * - Registration requests failing to be created
 *
 * This migration adds 'public' to the RLS policies so the Laravel app
 * (connecting via its own database user) can access all tables.
 */
return new class extends Migration
{
    public function up(): void
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
            'registration_requests',
            'asset_logs',
            'migrations',
            'cache',
            'jobs',
        ];

        foreach ($tables as $table) {
            // Check if the table exists before modifying policies
            $tableExists = DB::select("
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = ?
            ", [$table]);

            if (empty($tableExists)) {
                continue;
            }

            // Check if the existing policy exists
            $policyExists = DB::select("
                SELECT 1 FROM pg_policies 
                WHERE tablename = ? AND policyname = 'Allow authenticated read/write'
            ", [$table]);

            if (!empty($policyExists)) {
                // Drop and recreate the policy with public role added
                DB::statement("DROP POLICY \"Allow authenticated read/write\" ON {$table}");
            }

            DB::statement("
                CREATE POLICY \"Allow authenticated read/write\"
                ON {$table}
                FOR ALL
                TO authenticated, service_role, public
                USING (true)
                WITH CHECK (true)
            ");

            // For barangays, also update the anon read policy
            $anonPolicyExists = DB::select("
                SELECT 1 FROM pg_policies 
                WHERE tablename = ? AND policyname = 'Allow anon read'
            ", [$table]);

            if (!empty($anonPolicyExists)) {
                DB::statement("DROP POLICY \"Allow anon read\" ON {$table}");
                DB::statement("
                    CREATE POLICY \"Allow anon read\"
                    ON {$table}
                    FOR SELECT
                    TO anon, public
                    USING (true)
                ");
            }
        }

        \Log::info('RLS policies updated: added public role to all tables');
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
            'registration_requests',
            'asset_logs',
            'migrations',
            'cache',
            'jobs',
        ];

        foreach ($tables as $table) {
            $tableExists = DB::select("
                SELECT 1 FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name = ?
            ", [$table]);

            if (empty($tableExists)) {
                continue;
            }

            // Drop and recreate with original roles (no public)
            DB::statement("DROP POLICY IF EXISTS \"Allow authenticated read/write\" ON {$table}");

            DB::statement("
                CREATE POLICY \"Allow authenticated read/write\"
                ON {$table}
                FOR ALL
                TO authenticated, service_role
                USING (true)
                WITH CHECK (true)
            ");

            DB::statement("DROP POLICY IF EXISTS \"Allow anon read\" ON {$table}");

            DB::statement("
                CREATE POLICY \"Allow anon read\"
                ON {$table}
                FOR SELECT
                TO anon
                USING (true)
            ");
        }
    }
};
