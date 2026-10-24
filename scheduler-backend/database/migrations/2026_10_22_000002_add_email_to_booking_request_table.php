<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add email column to booking_request table
        // Stores the applicant's email address submitted on the booking form
        if (!Schema::hasColumn('booking_request', 'email')) {
            Schema::table('booking_request', function (Blueprint $table) {
                $table->string('email')->nullable()->after('address');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('booking_request', 'email')) {
            Schema::table('booking_request', function (Blueprint $table) {
                $table->dropColumn('email');
            });
        }
    }
};
