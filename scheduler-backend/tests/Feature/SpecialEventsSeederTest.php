<?php

namespace Tests\Feature;

use Carbon\Carbon;
use Database\Seeders\SpecialEventsSeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SpecialEventsSeederTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('booking_request');
        Schema::dropIfExists('resources');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('email');
            $table->string('role');
        });
        Schema::create('resources', function (Blueprint $table) {
            $table->id('resource_id');
            $table->string('name');
            $table->string('type');
            $table->string('status');
        });
        Schema::create('booking_request', function (Blueprint $table) {
            $table->id('booking_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('resource_id');
            $table->string('full_name');
            $table->string('purpose');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('start_time');
            $table->string('end_time');
            $table->string('status');
            $table->boolean('is_special_event');
            $table->timestamp('created_at');
        });

        DB::table('users')->insert([
            'user_id' => 1,
            'email' => 'mayors.office@system.local',
            'role' => 'admin',
        ]);

        foreach ([
            'Dumptruck (6-Wheel)',
            'Man Lift',
            'Mini-Bus',
            'Cargo Truck',
            'Municipal Gymnasium',
        ] as $name) {
            DB::table('resources')->insert([
                'name' => $name,
                'type' => str_contains(strtolower($name), 'gymnasium') ? 'facility' : 'vehicle',
                'status' => 'available',
            ]);
        }
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_seeder_creates_recurring_events_for_this_and_next_year_idempotently(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00', 'Asia/Manila'));
        $seeder = new SpecialEventsSeeder;

        $seeder->run();
        $initialCount = DB::table('booking_request')->count();
        $seeder->run();

        $this->assertGreaterThan(0, $initialCount);
        $this->assertSame($initialCount, DB::table('booking_request')->count());
        $this->assertDatabaseHas('booking_request', [
            'full_name' => 'Araw ng Habongan',
            'start_date' => '2026-07-01',
            'is_special_event' => true,
        ]);
        $this->assertDatabaseHas('booking_request', [
            'full_name' => 'Araw ng Habongan',
            'start_date' => '2027-07-01',
            'is_special_event' => true,
        ]);
        $this->assertDatabaseHas('booking_request', [
            'full_name' => 'High School Alumni',
            'start_date' => '2027-10-31',
            'is_special_event' => true,
        ]);
    }

    public function test_next_annual_seed_adds_the_following_year_and_clamps_invalid_month_days(): void
    {
        Carbon::setTestNow(Carbon::parse('2027-01-01 01:00:00', 'Asia/Manila'));

        (new SpecialEventsSeeder)->run();

        $this->assertDatabaseHas('booking_request', [
            'full_name' => 'High School Alumni',
            'start_date' => '2028-10-31',
            'is_special_event' => true,
        ]);

        $method = new \ReflectionMethod(SpecialEventsSeeder::class, 'annualDate');
        $method->setAccessible(true);

        $this->assertSame('2025-02-28', $method->invoke(new SpecialEventsSeeder, 2025, 2, 31));
        $this->assertSame('2028-10-31', $method->invoke(new SpecialEventsSeeder, 2028, 10, 31));
    }
}
