<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Remove soft-deleted user records from the database.
     *
     * The previous version of the User model used SoftDeletes, which left
     * records in the table with deleted_at set. After removing SoftDeletes
     * from the model, these stale records are no longer filtered out, causing
     * User::where('google_id', ...)->first() to find old records and prevent
     * JIT re-registration for deleted accounts.
     *
     * This migration hard-deletes any user records that have a non-null
     * deleted_at value, ensuring clean state for the JIT OAuth flow.
     */
    public function up(): void
    {
        // Check if deleted_at column exists before trying to use it
        $hasColumn = DB::select("
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'users' AND column_name = 'deleted_at'
        ");

        if (!empty($hasColumn)) {
            // Hard delete any soft-deleted records using DB facade, not Eloquent,
            // because Supabase Auth's deleted_at column can interfere with
            // Eloquent's delete() method (which respects soft deletes automatically)
            DB::table('users')
                ->whereNotNull('deleted_at')
                ->delete();
        }
    }

    public function down(): void
    {
        // This migration is destructive data cleanup — cannot be rolled back
    }
};
