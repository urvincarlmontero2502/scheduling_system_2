<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('registration_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->string('email');
            $table->string('full_name');
            $table->string('google_id')->nullable();
            $table->string('avatar')->nullable();
            $table->string('barangay');
            $table->string('role_requested')->default('staff');
            $table->string('status')->default('pending'); // pending, approved, rejected
            $table->timestamp('created_at')->useCurrent();
            $table->timestamp('reviewed_at')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->text('review_notes')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('registration_requests');
    }
};
