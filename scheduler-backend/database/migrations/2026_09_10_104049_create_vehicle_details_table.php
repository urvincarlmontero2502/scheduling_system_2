<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('vehicle_details', function (Blueprint $table) {
            $table->foreignId('resource_id')->primary()->constrained('resources', 'resource_id')->cascadeOnDelete();
            $table->string('driver_name')->nullable();
            $table->string('unit_name')->nullable();
            $table->string('plate_number')->nullable();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('vehicle_details');
    }
};
