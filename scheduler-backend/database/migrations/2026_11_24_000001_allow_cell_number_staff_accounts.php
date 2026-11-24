<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('cell_number')->nullable()->unique();
        });

        Schema::table('registration_requests', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
            $table->string('cell_number')->nullable()->unique();
        });
    }

    public function down(): void
    {
        if (
            DB::table('users')->whereNull('email')->exists()
            || DB::table('registration_requests')->whereNull('email')->exists()
        ) {
            throw new RuntimeException(
                'Cannot roll back cell-number accounts while phone-only users or registration requests exist.'
            );
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique('users_cell_number_unique');
            $table->dropColumn('cell_number');
            $table->string('email')->nullable(false)->change();
        });

        Schema::table('registration_requests', function (Blueprint $table) {
            $table->dropUnique('registration_requests_cell_number_unique');
            $table->dropColumn('cell_number');
            $table->string('email')->nullable(false)->change();
        });
    }
};
