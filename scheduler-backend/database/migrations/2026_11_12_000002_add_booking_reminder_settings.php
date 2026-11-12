<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('system_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('value');
            $table->timestamps();
        });

        Schema::table('booking_request', function (Blueprint $table) {
            $table->timestamp('reminder_sent_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('booking_request', function (Blueprint $table) {
            $table->dropColumn('reminder_sent_at');
        });

        Schema::dropIfExists('system_settings');
    }
};
