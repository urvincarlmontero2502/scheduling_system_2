<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add profile_image to users table
        if (!Schema::hasColumn('users', 'profile_image')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('profile_image')->nullable()->after('image');
            });
        }

        // Add asset_type column to resources for categorization
        if (!Schema::hasColumn('resources', 'asset_type')) {
            Schema::table('resources', function (Blueprint $table) {
                $table->string('asset_type')->nullable()->after('type');
            });
        }

        // Migration log for tracking asset-related schema changes
        if (!Schema::hasTable('asset_logs')) {
            Schema::create('asset_logs', function (Blueprint $table) {
                $table->id('log_id');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('asset_type'); // facility, vehicle, profile, branding
                $table->string('old_path')->nullable();
                $table->string('new_path');
                $table->string('action'); // upload, delete, replace
                $table->timestamps();

                $table->foreign('user_id')
                    ->references('user_id')
                    ->on('users')
                    ->onDelete('set null');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('asset_logs')) {
            Schema::dropIfExists('asset_logs');
        }

        if (Schema::hasColumn('resources', 'asset_type')) {
            Schema::table('resources', function (Blueprint $table) {
                $table->dropColumn('asset_type');
            });
        }

        if (Schema::hasColumn('users', 'profile_image')) {
            Schema::table('users', function (Blueprint $table) {
                $table->dropColumn('profile_image');
            });
        }
    }
};
