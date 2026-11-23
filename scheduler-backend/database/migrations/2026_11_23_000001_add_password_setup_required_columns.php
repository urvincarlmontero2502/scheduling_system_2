<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('users') && ! Schema::hasColumn('users', 'password_setup_required')) {
            Schema::table('users', function (Blueprint $table) {
                $table->boolean('password_setup_required')->default(false);
            });
        }

        if (Schema::hasColumn('users', 'google_id')) {
            DB::table('users')
                ->whereNotNull('google_id')
                ->update(['password_setup_required' => true]);
        }

        if (Schema::hasTable('registration_requests') && ! Schema::hasColumn('registration_requests', 'password_setup_required')) {
            Schema::table('registration_requests', function (Blueprint $table) {
                $table->boolean('password_setup_required')->default(false);
            });
        }

        if (Schema::hasTable('registration_requests') && Schema::hasColumn('registration_requests', 'google_id')) {
            DB::table('registration_requests')
                ->whereNotNull('google_id')
                ->update(['password_setup_required' => true]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('registration_requests') && Schema::hasColumn('registration_requests', 'password_setup_required')) {
            Schema::table('registration_requests', function (Blueprint $table) {
                $table->dropColumn('password_setup_required');
            });
        }

        if (Schema::hasTable('users') && Schema::hasColumn('users', 'password_setup_required')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('password_setup_required');
            });
        }
    }
};
