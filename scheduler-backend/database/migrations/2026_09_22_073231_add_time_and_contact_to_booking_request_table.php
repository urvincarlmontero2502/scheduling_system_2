<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
{
    Schema::table('booking_request', function (Blueprint $table) {
        $table->string('start_time')->nullable();
        $table->string('end_time')->nullable();
        $table->string('cell_number')->nullable();
        $table->text('address')->nullable();
    });
}

public function down(): void
{
    Schema::table('booking_request', function (Blueprint $table) {
        $table->dropColumn(['start_time', 'end_time', 'cell_number', 'address']);
    });
}
};
