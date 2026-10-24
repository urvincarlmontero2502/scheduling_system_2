<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Creates a registration_requests table to hold new staff sign-up requests
 * pending approval from barangay admins or the main admin.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registration_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->string('full_name');
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('google_id')->nullable()->index();
            $table->string('avatar')->nullable();
            $table->string('barangay');
            $table->string('department')->nullable();
            $table->string('role')->default('staff');
            $table->string('status')->default('pending'); // pending, approved, rejected
            $table->text('reject_reason')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('reviewed_by')
                ->references('user_id')
                ->on('users')
                ->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registration_requests');
    }
};
