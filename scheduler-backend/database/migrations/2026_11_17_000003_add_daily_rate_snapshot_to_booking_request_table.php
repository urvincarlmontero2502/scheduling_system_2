<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('booking_request', 'price_per_day')) {
            Schema::table('booking_request', function (Blueprint $table) {
                $table->decimal('price_per_day', 10, 2)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('booking_request', 'price_per_day')) {
            Schema::table('booking_request', function (Blueprint $table) {
                $table->dropColumn('price_per_day');
            });
        }
    }
};
