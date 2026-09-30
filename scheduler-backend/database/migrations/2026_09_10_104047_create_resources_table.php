<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('resources', function (Blueprint $table) {
            $table->id('resource_id');
            $table->string('name');
            $table->string('type'); // 'facility' or 'vehicle'
            $table->string('status')->default('available'); // available | in_use | unavailable
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('resources');
    }
};
