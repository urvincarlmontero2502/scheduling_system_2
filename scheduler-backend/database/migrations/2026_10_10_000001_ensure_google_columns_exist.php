<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

// Ensure google_id and email_verified_at columns exist in the users table.
// This is a safety net migration to handle cases where the original migration
// didn't run properly on Supabase PostgreSQL.
return new class extends Migration
{
    public function up(): void
    {
        // Use raw SQL to add columns if they don't exist (more reliable than Schema::hasColumn on Supabase)
        $columns = DB::connection()
            ->select("SELECT column_name FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public'");

        $columnNames = array_map(fn($c) => $c->column_name, $columns);

        if (!in_array('google_id', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL');
            DB::statement('CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id)');
        }

        if (!in_array('email_verified_at', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMP NULL');
        }

        if (!in_array('pending_email', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN pending_email VARCHAR(255) NULL');
        }

        if (!in_array('email_verification_token', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN email_verification_token VARCHAR(64) NULL');
        }

        if (!in_array('email_verification_sent_at', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN email_verification_sent_at TIMESTAMP NULL');
        }

        if (!in_array('profile_image', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN profile_image VARCHAR(255) NULL');
        }

        if (!in_array('barangay', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN barangay VARCHAR(255) NULL');
        }

        if (!in_array('department', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN department VARCHAR(255) NULL');
        }

        if (!in_array('avatar', $columnNames)) {
            DB::statement('ALTER TABLE users ADD COLUMN avatar VARCHAR(500) NULL');
        }
    }

    public function down(): void
    {
        // No-op: can't safely drop columns that might have data
    }
};
