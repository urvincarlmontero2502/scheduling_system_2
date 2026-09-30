<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Adds things your local database has but no migration creates.
// Every step is guarded, so it is safe to run on any database.
return new class extends Migration
{
    public function up(): void
    {
        // Sanctum tokens: login calls createToken(), which needs this table
        if (!Schema::hasTable('personal_access_tokens')) {
            Schema::create('personal_access_tokens', function (Blueprint $table) {
                $table->id();
                $table->morphs('tokenable');
                $table->text('name');
                $table->string('token', 64)->unique();
                $table->text('abilities')->nullable();
                $table->timestamp('last_used_at')->nullable();
                $table->timestamp('expires_at')->nullable()->index();
                $table->timestamps();
            });
        }

        // Used by BookingController and the seeder
        if (!Schema::hasColumn('users', 'barangay')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('barangay')->nullable();
            });
        }

        // Used by Resource model / ResourceController
        if (!Schema::hasColumn('resources', 'image')) {
            Schema::table('resources', function (Blueprint $table) {
                $table->string('image')->nullable();
            });
        }
        if (!Schema::hasColumn('resources', 'description')) {
            Schema::table('resources', function (Blueprint $table) {
                $table->text('description')->nullable();
            });
        }
    }

    public function down(): void
    {
        // Intentionally empty
    }
};
