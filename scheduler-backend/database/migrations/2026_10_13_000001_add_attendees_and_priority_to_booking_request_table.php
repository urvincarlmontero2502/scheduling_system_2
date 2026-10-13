<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('booking_request', function (Blueprint $table) {
            $table->integer('attendees')->nullable();
            $table->string('priority', 20)->nullable()->default('normal');
        });
    }

    public function down(): void
    {
        Schema::table('booking_request', function (Blueprint $table) {
            $table->dropColumn(['attendees', 'priority']);
        });
    }
};
