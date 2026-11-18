<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('booking_request')) {
            throw new RuntimeException('The booking_request table must exist before linking recurring events.');
        }

        if (! Schema::hasColumn('booking_request', 'special_event_template_id')) {
            Schema::table('booking_request', function (Blueprint $table) {
                $table->unsignedBigInteger('special_event_template_id')->nullable()->index();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('booking_request') && Schema::hasColumn('booking_request', 'special_event_template_id')) {
            Schema::table('booking_request', function (Blueprint $table) {
                $table->dropIndex(['special_event_template_id']);
                $table->dropColumn('special_event_template_id');
            });
        }
    }
};
