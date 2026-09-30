<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facility_details', function (Blueprint $table) {
            $table->foreignId('resource_id')->primary()->constrained('resources', 'resource_id')->cascadeOnDelete();
            $table->integer('capacity')->nullable();
            $table->string('location')->nullable();
            $table->text('amenities')->nullable();
            $table->timestamp('start_time')->nullable();
            $table->timestamp('end_time')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facility_details');
    }
};
