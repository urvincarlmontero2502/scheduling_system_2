<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add reference_id column to booking_request table
        // Format: JBG-YYYY-NNNN (e.g., JBG-2026-0184)
        // Used as human-readable reference for municipal office verification
        if (!Schema::hasColumn('booking_request', 'reference_id')) {
            Schema::table('booking_request', function (Blueprint $table) {
                $table->string('reference_id', 20)->nullable()->after('booking_id')->unique();
            });
        }

        // Backfill existing bookings with reference IDs
        // Format: JBG-{year}-{booking_id padded to 4 digits}
        // Skip PostgreSQL-specific backfill on SQLite (local dev)
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            $year = date('Y');
            \DB::statement("
                UPDATE booking_request
                SET reference_id = CONCAT('JBG-', '{$year}', '-', LPAD(CAST(booking_id AS TEXT), 4, '0'))
                WHERE reference_id IS NULL
            ");
        }

        // Make the column non-nullable after backfill (MySQL/SQLite compatible)
        // Note: SQLite doesn't support modifying column constraints easily,
        // so we leave it nullable — the app always sets it on creation.
    }

    public function down(): void
    {
        if (Schema::hasColumn('booking_request', 'reference_id')) {
            Schema::table('booking_request', function (Blueprint $table) {
                $table->dropUnique(['reference_id']);
                $table->dropColumn('reference_id');
            });
        }
    }
};
