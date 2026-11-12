<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('notifications') || !Schema::hasColumn('notifications', 'booking_id')) {
            return;
        }

        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            $bookingColumn = collect(
                Schema::getConnection()->select('PRAGMA table_info(notifications)')
            )->firstWhere('name', 'booking_id');

            if (!$bookingColumn || (int) $bookingColumn->notnull === 0) {
                return;
            }
        } elseif (Schema::getConnection()->getDriverName() === 'pgsql') {
            $column = Schema::getConnection()->selectOne(
                "SELECT is_nullable FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'booking_id'"
            );

            if (!$column || $column->is_nullable === 'YES') {
                return;
            }
        }

        Schema::table('notifications', function (Blueprint $table) {
            $table->unsignedBigInteger('booking_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        // Keep booking_id nullable because registration notifications may not
        // reference a booking and cannot be safely converted back to NOT NULL.
    }
};
