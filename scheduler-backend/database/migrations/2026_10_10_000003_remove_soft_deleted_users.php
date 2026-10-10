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
        // Try to hard-delete soft-deleted user records if the deleted_at column exists.
        // This is wrapped in try-catch because:
        // 1. The column might exist in Supabase's auth.users view but not in the
        //    actual application users table
        // 2. Different Supabase schemas may expose different columns
        try {
            DB::table('users')
                ->whereNotNull('deleted_at')
                ->delete();
        } catch (\Exception $e) {
            // Column doesn't exist or table doesn't support deletion — skip cleanup
            // The JIT flow now uses whereNull('deleted_at') guards, so any soft-deleted
            // records will be ignored even if they exist
        }
    }

    public function down(): void
    {
        // This migration is destructive data cleanup — cannot be rolled back
    }
};
