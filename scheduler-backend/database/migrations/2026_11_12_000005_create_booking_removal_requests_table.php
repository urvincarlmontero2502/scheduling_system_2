<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_removal_requests', function (Blueprint $table) {
            $table->bigIncrements('removal_request_id');
            $table->unsignedBigInteger('booking_id')->index();
            $table->unsignedBigInteger('requested_by')->index();
            $table->string('requester_name');
            $table->string('requester_role');
            $table->text('reason')->nullable();
            $table->json('booking_snapshot');
            $table->string('status')->default('pending')->index();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->text('review_note')->nullable();
            $table->timestamp('requested_at')->index();
            $table->timestamp('reviewed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_removal_requests');
    }
};
