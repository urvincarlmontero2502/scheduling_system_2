<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_request', function (Blueprint $table) {
            $table->timestamp('reminder_sms_sent_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('booking_request', function (Blueprint $table) {
            $table->dropColumn('reminder_sms_sent_at');
        });
    }
};
