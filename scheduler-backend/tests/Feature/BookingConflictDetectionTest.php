<?php

namespace Tests\Feature;

use App\Models\BookingRequest;
use App\Models\Resource;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingConflictDetectionTest extends TestCase
{
    private User $user;

    private Resource $resource;

    protected function setUp(): void
    {
        parent::setUp();

        Carbon::setTestNow(Carbon::parse('2026-11-01 12:00:00', 'Asia/Manila'));

        Schema::dropIfExists('booking_request');
        Schema::dropIfExists('resources');
        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email');
            $table->string('password_hash');
            $table->string('role');
        });
        Schema::create('resources', function (Blueprint $table) {
            $table->id('resource_id');
            $table->string('name');
            $table->string('type');
            $table->string('status');
            $table->unsignedInteger('buffer_minutes')->default(30);
            $table->json('images')->nullable();
        });
        Schema::create('booking_request', function (Blueprint $table) {
            $table->id('booking_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('resource_id');
            $table->string('reference_id')->nullable();
            $table->string('full_name')->nullable();
            $table->string('purpose')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('start_time')->nullable();
            $table->string('end_time')->nullable();
            $table->string('cell_number')->nullable();
            $table->text('address')->nullable();
            $table->string('email')->nullable();
            $table->string('status');
            $table->unsignedInteger('attendees')->nullable();
            $table->string('priority')->nullable();
            $table->boolean('is_special_event')->default(false);
        });

        $this->user = User::create([
            'full_name' => 'Booking Test User',
            'email' => 'booking-test@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'user',
        ]);
        $this->resource = Resource::create([
            'name' => 'Barangay Conference Room',
            'type' => 'facility',
            'status' => 'available',
        ]);

        Sanctum::actingAs($this->user);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_booking_request_rejects_dates_before_today_in_manila(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00', 'Asia/Manila'));

        $this->postJson('/api/bookings', $this->bookingPayload(
            '2026-11-11',
            '2026-11-11',
            '08:00',
            '17:00'
        ))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['start_date']);
    }

    public function test_booking_request_allows_starting_today_in_manila(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00', 'Asia/Manila'));

        $this->postJson('/api/bookings', $this->bookingPayload(
            '2026-11-12',
            '2026-11-12',
            '08:00',
            '17:00'
        ))->assertCreated();
    }

    public function test_conflicting_full_day_booking_returns_next_day_suggestion(): void
    {
        $this->createBooking('approved', '2026-11-02', '2026-11-02', '08:00', '17:00');

        $response = $this->postJson('/api/bookings', $this->bookingPayload(
            '2026-11-02',
            '2026-11-02',
            '08:00',
            '17:00'
        ));

        $response
            ->assertStatus(409)
            ->assertJsonPath('conflict', true)
            ->assertJsonPath(
                'message',
                'The requested time slot conflicts with an existing reservation.'
            )
            ->assertJsonPath('suggestions.0.start_time', '2026-11-03 08:00:00')
            ->assertJsonPath('suggestions.0.end_time', '2026-11-03 17:00:00')
            ->assertJsonPath('suggestions.0.label', 'Next available day, same time slot');
    }

    public function test_pending_bookings_block_overlapping_requests_and_offer_same_day_slot(): void
    {
        $this->createBooking('pending', '2026-11-02', '2026-11-02', '08:00', '12:00');

        $response = $this->postJson('/api/bookings', $this->bookingPayload(
            '2026-11-02',
            '2026-11-02',
            '12:15',
            '12:45'
        ));

        $response
            ->assertStatus(409)
            ->assertJsonPath('conflict', true)
            ->assertJsonPath('suggestions.0.start_time', '2026-11-02 12:30:00')
            ->assertJsonPath('suggestions.0.end_time', '2026-11-02 13:00:00')
            ->assertJsonPath('suggestions.0.label', 'Same day, later slot');
    }

    public function test_buffer_before_an_existing_booking_is_enforced(): void
    {
        $this->createBooking('approved', '2026-11-02', '2026-11-02', '12:00', '13:00');

        $this->postJson('/api/bookings', $this->bookingPayload(
            '2026-11-02',
            '2026-11-02',
            '11:15',
            '11:45'
        ))->assertStatus(409)->assertJsonPath('conflict', true);
    }

    public function test_approving_a_booking_rechecks_conflicts_and_returns_suggestions(): void
    {
        $this->createBooking('approved', '2026-11-02', '2026-11-02', '08:00', '12:00');
        $request = $this->createBooking(
            'pending',
            '2026-11-02',
            '2026-11-02',
            '11:00',
            '13:00'
        );
        $admin = User::create([
            'full_name' => 'Booking Test Admin',
            'email' => 'booking-admin@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'admin',
        ]);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/bookings/{$request->booking_id}/status", [
            'status' => 'approved',
        ])
            ->assertStatus(422)
            ->assertJsonPath('conflict', true)
            ->assertJsonStructure(['suggestions']);
    }

    public function test_request_starting_at_the_end_of_the_buffer_is_allowed(): void
    {
        $this->createBooking('approved', '2026-11-02', '2026-11-02', '08:00', '12:00');

        $this->postJson('/api/bookings', $this->bookingPayload(
            '2026-11-02',
            '2026-11-02',
            '12:30',
            '13:30'
        ))->assertCreated();
    }

    private function createBooking(
        string $status,
        string $startDate,
        string $endDate,
        string $startTime,
        string $endTime
    ): BookingRequest {
        return BookingRequest::create([
            'user_id' => $this->user->user_id,
            'resource_id' => $this->resource->resource_id,
            'full_name' => 'Existing Requester',
            'purpose' => 'Test reservation',
            'start_date' => $startDate,
            'end_date' => $endDate,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'status' => $status,
        ]);
    }

    private function bookingPayload(
        string $startDate,
        string $endDate,
        string $startTime,
        string $endTime
    ): array {
        return [
            'resource_id' => $this->resource->resource_id,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'start_time' => $startTime,
            'end_time' => $endTime,
            'purpose' => 'Test reservation',
        ];
    }
}
