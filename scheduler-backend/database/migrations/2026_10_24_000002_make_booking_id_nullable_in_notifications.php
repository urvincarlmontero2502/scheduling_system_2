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
        Schema::table('notifications', function (Blueprint $table) {
            // Drop the foreign key constraint and the column, then re-add it as nullable
            $table->dropForeign(['booking_id']);
            $table->foreignId('booking_id')->nullable()->constrained('booking_request', 'booking_id')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropForeign(['booking_id']);
            $table->foreignId('booking_id')->constrained('booking_request', 'booking_id')->cascadeOnDelete();
        });
    }
};
