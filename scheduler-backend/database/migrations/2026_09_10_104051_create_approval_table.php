<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval', function (Blueprint $table) {
            $table->id('log_id');
            $table->foreignId('booking_id')->constrained('booking_request', 'booking_id')->cascadeOnDelete();
            $table->foreignId('admin_id')->constrained('users', 'user_id')->cascadeOnDelete();
            $table->string('action'); // 'approved' or 'rejected'
            $table->text('remarks')->nullable();
            $table->timestamp('action_date')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval');
    }
};
