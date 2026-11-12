<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // Superseded by 2026_10_24_000001_create_registration_requests_table.
        // Keep this migration as a no-op because some existing databases
        // already have the canonical table and still have this migration pending.
    }

    public function down(): void
    {
        // This migration does not own the registration_requests table.
    }
};
