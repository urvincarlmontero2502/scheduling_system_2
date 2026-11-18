<?php

namespace Tests\Feature;

use App\Models\SpecialEventTemplate;
use App\Models\User;
use App\Services\SpecialEventReservationSeeder;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SpecialEventTemplateTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('booking_request');
        Schema::dropIfExists('special_event_templates');
        Schema::dropIfExists('resources');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email');
            $table->string('password_hash');
            $table->string('role');
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('resources', function (Blueprint $table) {
            $table->id('resource_id');
            $table->string('name');
            $table->string('type');
            $table->string('status');
            $table->timestamp('deleted_at')->nullable();
        });

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
            $table->unsignedBigInteger('special_event_template_id')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        DB::table('users')->insert([
            'user_id' => 1,
            'full_name' => 'Mayor Office',
            'email' => 'mayors.office@system.local',
            'password_hash' => 'not-a-real-password',
            'role' => 'admin',
        ]);
        DB::table('resources')->insert([
            ['resource_id' => 1, 'name' => 'Municipal Gymnasium', 'type' => 'facility', 'status' => 'available'],
            ['resource_id' => 2, 'name' => 'Mini-Bus', 'type' => 'vehicle', 'status' => 'available'],
        ]);

        Carbon::setTestNow(Carbon::parse('2026-11-18 12:00:00', 'Asia/Manila'));
        Sanctum::actingAs(User::findOrFail(1));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_admin_can_add_an_annual_event_that_is_generated_in_following_years(): void
    {
        $response = $this->postJson('/api/special-events', [
            'name' => 'Municipal Foundation Day',
            'start_date' => '2026-07-21',
            'end_date' => '2026-07-22',
            'resource_ids' => [1],
        ])->assertCreated();

        $templateId = $response->json('id');
        $this->assertDatabaseHas('booking_request', [
            'full_name' => 'Municipal Foundation Day',
            'resource_id' => 1,
            'start_date' => '2027-07-21',
            'special_event_template_id' => $templateId,
        ]);
        $this->assertDatabaseMissing('booking_request', [
            'full_name' => 'Municipal Foundation Day',
            'start_date' => '2026-07-21',
        ]);

        Carbon::setTestNow(Carbon::parse('2027-01-01 12:00:00', 'Asia/Manila'));
        app(SpecialEventReservationSeeder::class)->run();

        $this->assertDatabaseHas('booking_request', [
            'full_name' => 'Municipal Foundation Day',
            'resource_id' => 1,
            'start_date' => '2028-07-21',
            'special_event_template_id' => $templateId,
        ]);
        $this->assertSame(
            4,
            DB::table('booking_request')
                ->where('special_event_template_id', $templateId)
                ->count()
        );
    }

    public function test_first_template_seed_links_existing_reservations_without_duplicates(): void
    {
        DB::table('booking_request')->insert([
            'user_id' => 1,
            'resource_id' => 2,
            'full_name' => 'Sumayajaw Festival',
            'purpose' => 'Annual Community Festival / Official Event',
            'start_date' => '2027-08-11',
            'end_date' => '2027-08-11',
            'start_time' => '07:00:00',
            'end_time' => '17:00:00',
            'status' => 'approved',
            'is_special_event' => true,
        ]);

        app(SpecialEventReservationSeeder::class)->run();

        $template = SpecialEventTemplate::query()
            ->where('name', 'Sumayajaw Festival')
            ->where('start_day', 11)
            ->firstOrFail();

        $this->assertSame(
            1,
            DB::table('booking_request')
                ->where('full_name', 'Sumayajaw Festival')
                ->where('resource_id', 2)
                ->where('start_date', '2027-08-11')
                ->count()
        );
        $this->assertDatabaseHas('booking_request', [
            'full_name' => 'Sumayajaw Festival',
            'resource_id' => 2,
            'start_date' => '2027-08-11',
            'special_event_template_id' => $template->id,
        ]);
    }

    public function test_editing_a_template_replaces_only_its_upcoming_reservations(): void
    {
        $templateId = $this->createEventTemplate();

        $this->putJson("/api/special-events/{$templateId}", [
            'name' => 'Town Celebration',
            'start_date' => '2026-07-25',
            'end_date' => '2026-07-25',
            'resource_ids' => [2],
        ])->assertOk()
            ->assertJsonPath('name', 'Town Celebration')
            ->assertJsonPath('start_date', '2026-07-25');

        $this->assertDatabaseMissing('booking_request', [
            'special_event_template_id' => $templateId,
            'start_date' => '2027-07-21',
        ]);
        $this->assertDatabaseHas('booking_request', [
            'special_event_template_id' => $templateId,
            'resource_id' => 2,
            'start_date' => '2027-07-25',
        ]);
    }

    public function test_removing_a_template_clears_future_reservations_but_keeps_past_records(): void
    {
        $templateId = $this->createEventTemplate();
        DB::table('booking_request')->insert([
            'user_id' => 1,
            'resource_id' => 1,
            'full_name' => 'Municipal Foundation Day',
            'purpose' => 'Annual event',
            'start_date' => '2026-07-21',
            'end_date' => '2026-07-21',
            'start_time' => '07:00:00',
            'end_time' => '17:00:00',
            'status' => 'approved',
            'is_special_event' => true,
            'special_event_template_id' => $templateId,
        ]);

        $this->deleteJson("/api/special-events/{$templateId}")
            ->assertOk()
            ->assertJsonPath('message', 'The recurring event was removed. Past reservations were kept.');

        $this->assertSoftDeleted('special_event_templates', ['id' => $templateId]);
        $this->assertDatabaseMissing('booking_request', [
            'special_event_template_id' => $templateId,
            'start_date' => '2027-07-21',
        ]);
        $this->assertDatabaseHas('booking_request', [
            'special_event_template_id' => $templateId,
            'start_date' => '2026-07-21',
        ]);
    }

    public function test_recurring_resource_and_date_conflicts_are_rejected(): void
    {
        $this->createEventTemplate();

        $this->postJson('/api/special-events', [
            'name' => 'Overlapping Event',
            'start_date' => '2027-07-22',
            'end_date' => '2027-07-23',
            'resource_ids' => [1],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('resource_ids');
    }

    public function test_event_creation_is_rejected_when_future_bookings_conflict(): void
    {
        DB::table('booking_request')->insert([
            'user_id' => 1,
            'resource_id' => 1,
            'full_name' => 'Existing Booking',
            'purpose' => 'Already approved',
            'start_date' => '2027-07-21',
            'end_date' => '2027-07-21',
            'start_time' => '08:00:00',
            'end_time' => '09:00:00',
            'status' => 'approved',
            'is_special_event' => false,
        ]);

        $this->postJson('/api/special-events', [
            'name' => 'Municipal Foundation Day',
            'start_date' => '2026-07-21',
            'end_date' => '2026-07-21',
            'resource_ids' => [1],
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('resource_ids');

        $this->assertSame(0, SpecialEventTemplate::query()->count());
    }

    public function test_non_admin_users_cannot_manage_recurring_events(): void
    {
        $user = User::create([
            'full_name' => 'Regular User',
            'email' => 'staff@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'staff',
        ]);
        Sanctum::actingAs($user);

        $this->postJson('/api/special-events', [
            'name' => 'Restricted Event',
            'start_date' => '2027-07-21',
            'end_date' => '2027-07-21',
            'resource_ids' => [1],
        ])->assertForbidden();
    }

    private function createEventTemplate(): int
    {
        return $this->postJson('/api/special-events', [
            'name' => 'Municipal Foundation Day',
            'start_date' => '2026-07-21',
            'end_date' => '2026-07-22',
            'resource_ids' => [1],
        ])->assertCreated()->json('id');
    }
}
