<?php

use Database\Seeders\SpecialEventsSeeder;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * booking_request has created_at only (no updated_at). Inserting
     * updated_at made this migration fail on PostgreSQL, and start.sh
     * hid that error, so production never received the festival rows.
     * The seeder is idempotent and is also run on every boot.
     */
    public function up(): void
    {
        (new SpecialEventsSeeder())->run();
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('booking_request')->where('is_special_event', true)->delete();
    }

};