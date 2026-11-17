<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('booking_vehicles', function (Blueprint $table) {
            $table->foreignId('booking_id')
                ->constrained('booking_request', 'booking_id')
                ->cascadeOnDelete();
            $table->foreignId('resource_id')
                ->constrained('resources', 'resource_id')
                ->cascadeOnDelete();
            $table->decimal('price_per_hour', 10, 2)->nullable();
            $table->primary(['booking_id', 'resource_id']);
            $table->index('resource_id');
        });

        $existingVehicleBookings = DB::table('booking_request')
            ->join('resources', 'resources.resource_id', '=', 'booking_request.resource_id')
            ->where('resources.type', 'vehicle')
            ->selectRaw(
                'booking_request.booking_id, resources.resource_id, COALESCE(booking_request.price_per_hour, resources.price_per_hour) as price_per_hour'
            );

        DB::table('booking_vehicles')->insertUsing(
            ['booking_id', 'resource_id', 'price_per_hour'],
            $existingVehicleBookings
        );

        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE booking_vehicles ENABLE ROW LEVEL SECURITY');
            DB::statement('
                CREATE POLICY "Allow authenticated read/write"
                ON booking_vehicles
                FOR ALL
                TO authenticated, service_role
                USING (true)
                WITH CHECK (true)
            ');
            DB::statement('GRANT SELECT ON booking_vehicles TO anon');
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON booking_vehicles TO authenticated');
            DB::statement('GRANT SELECT, INSERT, UPDATE, DELETE ON booking_vehicles TO service_role');
        }
    }

    public function down(): void
    {
        if (DB::connection()->getDriverName() === 'pgsql') {
            DB::statement('DROP POLICY IF EXISTS "Allow authenticated read/write" ON booking_vehicles');
            DB::statement('ALTER TABLE booking_vehicles DISABLE ROW LEVEL SECURITY');
        }

        Schema::dropIfExists('booking_vehicles');
    }
};
