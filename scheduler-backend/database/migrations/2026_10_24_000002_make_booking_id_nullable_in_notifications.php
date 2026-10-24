<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Makes booking_id nullable in the notifications table.
 *
 * This allows creating notifications that are not tied to a specific booking
 * (e.g., registration request notifications, account approval notifications).
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('notifications')) {
            return;
        }

        $dbDriver = Schema::getConnection()->getDriverName();

        // Check current nullability
        $columns = Schema::getConnection()
            ->select("SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'booking_id'");

        if (empty($columns)) {
            return; // Column doesn't exist
        }

        if ($columns[0]->is_nullable === 'YES') {
            return; // Already nullable
        }

        // Drop the foreign key constraint then make the column nullable
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['booking_id']);
        });

        if ($dbDriver === 'pgsql') {
            \DB::statement('ALTER TABLE notifications ALTER COLUMN booking_id DROP NOT NULL');
        } else {
            \DB::statement('ALTER TABLE notifications MODIFY booking_id BIGINT NULL');
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('notifications')) {
            return;
        }

        $dbDriver = Schema::getConnection()->getDriverName();

        if ($dbDriver === 'pgsql') {
            \DB::statement('ALTER TABLE notifications ALTER COLUMN booking_id SET NOT NULL');
        } else {
            \DB::statement('ALTER TABLE notifications MODIFY booking_id BIGINT NOT NULL');
        }

        Schema::table('notifications', function (Blueprint $table) {
            $table->foreign('booking_id')->references('booking_id')->on('booking_request')->cascadeOnDelete();
        });
    }
};
