<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_request', function (Blueprint $table) {
            $table->id('booking_id');
            $table->foreignId('user_id')->constrained('users', 'user_id')->cascadeOnDelete();
            $table->foreignId('resource_id')->constrained('resources', 'resource_id')->cascadeOnDelete();
            $table->string('purpose')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('status')->default('pending'); // pending | approved | rejected
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_request');
    }
};
