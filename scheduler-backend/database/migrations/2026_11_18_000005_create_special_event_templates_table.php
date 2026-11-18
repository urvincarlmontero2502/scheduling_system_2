<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('special_event_templates')) {
            Schema::create('special_event_templates', function (Blueprint $table) {
                $table->id();
                $table->string('name');
                $table->unsignedSmallInteger('start_year');
                $table->unsignedTinyInteger('start_month');
                $table->unsignedTinyInteger('start_day');
                $table->unsignedTinyInteger('end_month');
                $table->unsignedTinyInteger('end_day');
                $table->json('resource_ids');
                $table->timestamps();
                $table->softDeletes();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('special_event_templates');
    }
};
