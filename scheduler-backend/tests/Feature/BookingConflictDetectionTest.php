<?php

namespace Tests\Feature;

use App\Mail\BookingApproved;
use App\Mail\BookingRejected;
use App\Models\BookingRequest;
use App\Models\Resource;
use App\Models\User;
use App\Services\BookingStatementOfAccount;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Mail;
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

        Schema::dropIfExists('booking_vehicles');
        Schema::dropIfExists('booking_request');
        Schema::dropIfExists('approval');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('facility_details');
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
            $table->decimal('price_per_day', 10, 2)->nullable();
            $table->decimal('price_per_hour', 10, 2)->nullable();
            $table->unsignedInteger('buffer_minutes')->default(30);
            $table->json('images')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('facility_details', function (Blueprint $table) {
            $table->unsignedBigInteger('resource_id')->primary();
            $table->unsignedInteger('capacity')->nullable();
        });
        Schema::create('booking_request', function (Blueprint $table) {
            $table->id('booking_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('resource_id');
            $table->string('reference_id')->nullable();
            $table->string('full_name')->nullable();
            $table->string('purpose')->nullable();
            $table->text('destination')->nullable();
            $table->decimal('price_per_day', 10, 2)->nullable();
            $table->decimal('price_per_hour', 10, 2)->nullable();
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
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('booking_vehicles', function (Blueprint $table) {
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('resource_id');
            $table->decimal('price_per_hour', 10, 2)->nullable();
            $table->primary(['booking_id', 'resource_id']);
        });
        Schema::create('approval', function (Blueprint $table) {
            $table->id('log_id');
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('admin_id');
            $table->string('action');
            $table->text('remarks')->nullable();
        });
        Schema::create('notifications', function (Blueprint $table) {
            $table->id('notif_id');
            $table->unsignedBigInteger('booking_id')->nullable();
            $table->unsignedBigInteger('user_id');
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->string('type');
            $table->string('title');
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('activity_logs', function (Blueprint $table) {
            $table->bigIncrements('activity_log_id');
            $table->unsignedBigInteger('actor_id')->nullable();
            $table->string('actor_name');
            $table->string('actor_role');
            $table->string('action');
            $table->string('subject_type')->nullable();
            $table->string('subject_id')->nullable();
            $table->text('description');
            $table->json('properties')->nullable();
            $table->timestamp('created_at');
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

        $this->assertDatabaseHas('activity_logs', [
            'actor_id' => $this->user->user_id,
            'action' => 'booking.requested',
            'subject_type' => 'booking',
        ]);
    }

    public function test_booking_details_preserve_the_values_submitted_from_booking_modal(): void
    {
        $payload = array_merge(
            $this->bookingPayload('2026-11-02', '2026-11-02', '08:00', '11:00'),
            [
                'full_name' => $this->user->full_name,
                'purpose' => 'Deliver materials',
                'destination' => 'Barangay Hall',
                'cell_number' => '09123456789',
                'email' => 'booking-test@example.test',
                'address' => '123 Main Street',
                'attendees' => 25,
                'priority' => 'high',
            ],
        );

        $this->postJson('/api/bookings', $payload)
            ->assertCreated()
            ->assertJsonPath('full_name', $this->user->full_name)
            ->assertJsonPath('purpose', 'Deliver materials')
            ->assertJsonPath('destination', 'Barangay Hall')
            ->assertJsonPath('attendees', 25)
            ->assertJsonPath('priority', 'high');

        $this->assertDatabaseHas('booking_request', [
            'destination' => 'Barangay Hall',
            'purpose' => 'Deliver materials',
            'attendees' => 25,
            'priority' => 'high',
        ]);

        $this->getJson('/api/bookings')
            ->assertOk()
            ->assertJsonPath('0.full_name', $this->user->full_name)
            ->assertJsonPath('0.resource_type', 'facility')
            ->assertJsonPath('0.destination', 'Barangay Hall')
            ->assertJsonPath('0.cell_number', '09123456789')
            ->assertJsonPath('0.address', '123 Main Street')
            ->assertJsonPath('0.attendees', 25)
            ->assertJsonPath('0.priority', 'high');
    }

    public function test_vehicle_booking_details_include_the_hourly_rate_at_submission_time(): void
    {
        $vehicle = Resource::create([
            'name' => 'Backhoe',
            'type' => 'vehicle',
            'status' => 'available',
            'price_per_hour' => 2543,
        ]);
        $payload = $this->bookingPayload('2026-11-02', '2026-11-02', '08:00', '11:00');
        $payload['resource_id'] = $vehicle->resource_id;

        $this->postJson('/api/bookings', $payload)
            ->assertCreated()
            ->assertJsonPath('price_per_hour', '2543.00');

        $this->getJson('/api/bookings')
            ->assertOk()
            ->assertJsonPath('0.price_per_hour', '2543.00');
        $this->assertDatabaseHas('booking_vehicles', [
            'resource_id' => $vehicle->resource_id,
            'price_per_hour' => 2543,
        ]);
    }

    public function test_multiple_vehicles_are_saved_as_one_booking_and_returned_together(): void
    {
        $navara = Resource::create([
            'name' => 'Nissan Navara',
            'type' => 'vehicle',
            'status' => 'available',
            'price_per_hour' => 1000,
        ]);
        $van = Resource::create([
            'name' => 'Toyota HiAce Van',
            'type' => 'vehicle',
            'status' => 'available',
            'price_per_hour' => 1500,
        ]);
        $payload = $this->bookingPayload('2026-11-02', '2026-11-02', '08:00', '11:00');
        $payload['resource_id'] = $navara->resource_id;
        $payload['resource_ids'] = [$navara->resource_id, $van->resource_id];

        $response = $this->postJson('/api/bookings', $payload)
            ->assertCreated()
            ->assertJsonPath('resource_id', $navara->resource_id)
            ->assertJsonPath('vehicles.0.name', 'Nissan Navara')
            ->assertJsonPath('vehicles.1.name', 'Toyota HiAce Van');

        $bookingId = $response->json('booking_id');
        $this->assertDatabaseCount('booking_request', 1);
        $this->assertDatabaseHas('booking_vehicles', [
            'booking_id' => $bookingId,
            'resource_id' => $navara->resource_id,
            'price_per_hour' => 1000,
        ]);
        $this->assertDatabaseHas('booking_vehicles', [
            'booking_id' => $bookingId,
            'resource_id' => $van->resource_id,
            'price_per_hour' => 1500,
        ]);

        $this->getJson('/api/bookings')
            ->assertOk()
            ->assertJsonPath('0.resource_ids', [$navara->resource_id, $van->resource_id])
            ->assertJsonPath('0.resource_names', ['Nissan Navara', 'Toyota HiAce Van']);
    }

    public function test_multi_vehicle_request_rejects_facilities(): void
    {
        $vehicle = Resource::create([
            'name' => 'Ambulance #1',
            'type' => 'vehicle',
            'status' => 'available',
        ]);
        $payload = $this->bookingPayload('2026-11-02', '2026-11-02', '08:00', '11:00');
        $payload['resource_ids'] = [$this->resource->resource_id, $vehicle->resource_id];

        $this->postJson('/api/bookings', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['resource_ids']);

        $this->assertDatabaseCount('booking_request', 0);
    }

    public function test_multi_vehicle_request_rejects_duplicate_resource_ids(): void
    {
        $vehicle = Resource::create([
            'name' => 'Ambulance #1',
            'type' => 'vehicle',
            'status' => 'available',
        ]);
        $payload = $this->bookingPayload('2026-11-02', '2026-11-02', '08:00', '11:00');
        $payload['resource_ids'] = [$vehicle->resource_id, $vehicle->resource_id];

        $this->postJson('/api/bookings', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['resource_ids.1']);

        $this->assertDatabaseCount('booking_request', 0);
    }

    public function test_conflicts_on_secondary_vehicle_block_the_entire_request(): void
    {
        $navara = Resource::create([
            'name' => 'Nissan Navara',
            'type' => 'vehicle',
            'status' => 'available',
        ]);
        $van = Resource::create([
            'name' => 'Toyota HiAce Van',
            'type' => 'vehicle',
            'status' => 'available',
        ]);
        $dumpTruck = Resource::create([
            'name' => 'Dump Truck #1',
            'type' => 'vehicle',
            'status' => 'available',
        ]);
        $existing = BookingRequest::create([
            'user_id' => $this->user->user_id,
            'resource_id' => $dumpTruck->resource_id,
            'full_name' => 'Existing Requester',
            'purpose' => 'Test reservation',
            'start_date' => '2026-11-02',
            'end_date' => '2026-11-02',
            'start_time' => '08:00',
            'end_time' => '12:00',
            'status' => 'approved',
        ]);
        $existing->vehicles()->attach($van->resource_id, ['price_per_hour' => null]);

        $this->getJson('/api/bookings/availability?'.http_build_query([
            'resource_id' => $van->resource_id,
            'date' => '2026-11-02',
            'start_time' => '08:00',
            'end_time' => '09:00',
        ]))
            ->assertOk()
            ->assertJsonCount(0, 'available_slots');

        $this->getJson('/api/bookings/availability?'.http_build_query([
            'resource_id' => $van->resource_id,
            'date' => '2026-11-02',
            'start_time' => '12:30',
            'end_time' => '13:30',
        ]))
            ->assertOk()
            ->assertJsonPath('available_slots.0.start_time', '12:30');

        $payload = $this->bookingPayload('2026-11-02', '2026-11-02', '08:00', '11:00');
        $payload['resource_id'] = $navara->resource_id;
        $payload['resource_ids'] = [$navara->resource_id, $van->resource_id];

        $this->postJson('/api/bookings', $payload)
            ->assertStatus(409)
            ->assertJsonPath('unavailable_vehicles.0.name', 'Toyota HiAce Van');

        $this->assertDatabaseCount('booking_request', 1);
    }

    public function test_approval_rechecks_conflicts_for_every_linked_vehicle(): void
    {
        $navara = Resource::create([
            'name' => 'Nissan Navara',
            'type' => 'vehicle',
            'status' => 'available',
        ]);
        $van = Resource::create([
            'name' => 'Toyota HiAce Van',
            'type' => 'vehicle',
            'status' => 'available',
        ]);
        $dumpTruck = Resource::create([
            'name' => 'Dump Truck #1',
            'type' => 'vehicle',
            'status' => 'available',
        ]);
        $existing = BookingRequest::create([
            'user_id' => $this->user->user_id,
            'resource_id' => $dumpTruck->resource_id,
            'full_name' => 'Existing Requester',
            'purpose' => 'Test reservation',
            'start_date' => '2026-11-02',
            'end_date' => '2026-11-02',
            'start_time' => '08:00',
            'end_time' => '12:00',
            'status' => 'approved',
        ]);
        $existing->vehicles()->attach($van->resource_id, ['price_per_hour' => null]);

        $request = BookingRequest::create([
            'user_id' => $this->user->user_id,
            'resource_id' => $navara->resource_id,
            'full_name' => 'Pending Requester',
            'purpose' => 'Test reservation',
            'start_date' => '2026-11-02',
            'end_date' => '2026-11-02',
            'start_time' => '08:00',
            'end_time' => '11:00',
            'status' => 'pending',
        ]);
        $request->vehicles()->sync([
            $navara->resource_id => ['price_per_hour' => null],
            $van->resource_id => ['price_per_hour' => null],
        ]);
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $this->patchJson("/api/bookings/{$request->booking_id}/status", [
            'status' => 'approved',
        ])
            ->assertStatus(422)
            ->assertJsonPath('unavailable_vehicles.0.name', 'Toyota HiAce Van')
            ->assertJsonPath('conflicts.0.resource_name', 'Toyota HiAce Van')
            ->assertJsonPath('conflicts.0.status', 'approved')
            ->assertJsonPath('conflicts.0.start_date', '2026-11-02')
            ->assertJsonPath('conflicts.0.start_time', '08:00')
            ->assertJsonPath('conflicts.0.buffer_minutes', 30);
    }

    public function test_facility_booking_details_include_the_daily_rate_at_submission_time(): void
    {
        $facility = Resource::create([
            'name' => 'Community Hall',
            'type' => 'facility',
            'status' => 'available',
            'price_per_day' => 1500,
        ]);
        $payload = $this->bookingPayload('2026-11-02', '2026-11-03', '08:00', '17:00');
        $payload['resource_id'] = $facility->resource_id;

        $this->postJson('/api/bookings', $payload)
            ->assertCreated()
            ->assertJsonPath('price_per_day', '1500.00');

        $facility->update(['price_per_day' => 2000]);

        $this->getJson('/api/bookings')
            ->assertOk()
            ->assertJsonPath('0.price_per_day', '1500.00');
    }

    public function test_approved_email_contains_the_soa_and_attaches_a_pdf(): void
    {
        $this->resource->update(['price_per_day' => 1500]);
        $booking = $this->createBooking('approved', '2026-11-02', '2026-11-03', '08:00', '17:00');
        $booking->update([
            'price_per_day' => 1500,
            'reference_id' => 'JBG-2026-0001',
        ]);
        $mail = new BookingApproved($booking, $this->user);

        $this->assertSame(3000.0, $mail->soa['amount']);
        $this->assertStringContainsString('JBG-2026-0001', $mail->render());
        $this->assertStringContainsString(
            'Your Statement of Account (SOA) is attached as a PDF.',
            $mail->render()
        );

        $attachment = $mail->attachments()[0];
        $pdf = $attachment->attachWith(
            fn () => null,
            fn ($data) => $data()
        );

        $this->assertSame('SOA-JBG-2026-0001.pdf', $attachment->as);
        $this->assertStringStartsWith('%PDF-', $pdf);
    }

    public function test_booking_soa_uses_the_saved_vehicle_hourly_rate_and_rounds_up(): void
    {
        $vehicle = Resource::create([
            'name' => 'Backhoe',
            'type' => 'vehicle',
            'status' => 'available',
            'price_per_hour' => 200,
        ]);
        $booking = $this->createBooking('approved', '2026-11-02', '2026-11-02', '08:00', '09:01');
        $booking->update([
            'resource_id' => $vehicle->resource_id,
            'price_per_hour' => 200,
            'reference_id' => 'JBG-2026-0002',
        ]);

        $soa = app(BookingStatementOfAccount::class)->build($booking);

        $this->assertSame('2 billable hours', $soa['quantity_label']);
        $this->assertSame(400.0, $soa['amount']);
    }

    public function test_vehicle_soa_totals_all_selected_vehicles_using_saved_rates(): void
    {
        $navara = Resource::create([
            'name' => 'Nissan Navara',
            'type' => 'vehicle',
            'status' => 'available',
            'price_per_hour' => 1000,
        ]);
        $van = Resource::create([
            'name' => 'Toyota HiAce Van',
            'type' => 'vehicle',
            'status' => 'available',
            'price_per_hour' => 1500,
        ]);
        $booking = $this->createBooking('approved', '2026-11-02', '2026-11-02', '08:00', '11:00');
        $booking->update([
            'resource_id' => $navara->resource_id,
            'price_per_hour' => 1000,
            'reference_id' => 'JBG-2026-0003',
        ]);
        $booking->vehicles()->sync([
            $navara->resource_id => ['price_per_hour' => 1000],
            $van->resource_id => ['price_per_hour' => 1500],
        ]);

        $soa = app(BookingStatementOfAccount::class)->build($booking);

        $this->assertSame(['Nissan Navara', 'Toyota HiAce Van'], $soa['resource_names']);
        $this->assertSame(7500.0, $soa['amount']);
        $this->assertSame([3000.0, 4500.0], array_column($soa['charges'], 'amount'));

        $mail = new BookingApproved($booking, $this->user);
        $this->assertStringContainsString('Nissan Navara', $mail->render());
        $this->assertStringContainsString('Toyota HiAce Van', $mail->render());
        $this->assertStringContainsString('₱7,500.00', $mail->render());
    }

    public function test_rejection_email_renders_the_reason_provided(): void
    {
        $booking = $this->createBooking('rejected', '2026-11-02', '2026-11-02', '08:00', '10:00');
        $mail = new BookingRejected($booking, $this->user, 'Resource unavailable for maintenance.');

        $this->assertStringContainsString('Booking request update', $mail->render());
        $this->assertStringContainsString('Resource unavailable for maintenance.', $mail->render());
    }

    public function test_approval_email_is_sent_to_the_email_entered_for_the_booking(): void
    {
        $booking = $this->createBooking('pending', '2026-11-02', '2026-11-02', '08:00', '10:00');
        $booking->update(['email' => 'requestor@gmail.com']);
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);
        config(['mail.default' => 'brevo']);
        Mail::fake();

        $this->patchJson("/api/bookings/{$booking->booking_id}/status", [
            'status' => 'approved',
        ])->assertOk()->assertJsonPath('email_notification_sent', true);

        Mail::assertSent(BookingApproved::class, fn (BookingApproved $mail) => $mail->hasTo('requestor@gmail.com'));
    }

    public function test_rejection_email_is_sent_to_the_email_entered_for_the_booking(): void
    {
        $booking = $this->createBooking('pending', '2026-11-02', '2026-11-02', '08:00', '10:00');
        $booking->update(['email' => 'requestor@gmail.com']);
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);
        config(['mail.default' => 'brevo']);
        Mail::fake();

        $this->patchJson("/api/bookings/{$booking->booking_id}/status", [
            'status' => 'rejected',
        ])->assertOk()->assertJsonPath('email_notification_sent', true);

        Mail::assertSent(BookingRejected::class, fn (BookingRejected $mail) => $mail->hasTo('requestor@gmail.com'));
    }

    public function test_booking_status_email_falls_back_to_the_account_email(): void
    {
        $booking = $this->createBooking('pending', '2026-11-02', '2026-11-02', '08:00', '10:00');
        $booking->update(['email' => null]);
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);
        config(['mail.default' => 'brevo']);
        Mail::fake();

        $this->patchJson("/api/bookings/{$booking->booking_id}/status", [
            'status' => 'approved',
        ])->assertOk()->assertJsonPath('email_notification_sent', true);

        Mail::assertSent(BookingApproved::class, fn (BookingApproved $mail) => $mail->hasTo($this->user->email));
    }

    public function test_missing_brevo_key_reports_that_status_email_was_not_sent(): void
    {
        $booking = $this->createBooking('pending', '2026-11-02', '2026-11-02', '08:00', '10:00');
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);
        config(['services.brevo.key' => null]);
        Mail::purge('brevo');

        $this->patchJson("/api/bookings/{$booking->booking_id}/status", [
            'status' => 'approved',
        ])
            ->assertOk()
            ->assertJsonPath('email_notification_sent', false)
            ->assertJsonPath(
                'email_notification_message',
                'The booking status changed, but its email notification could not be sent. Check the backend mail configuration.'
            );
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

    public function test_pending_booking_overlap_requires_confirmation_and_offers_a_slot(): void
    {
        $this->createBooking('pending', '2026-11-02', '2026-11-02', '08:00', '12:00');

        $payload = $this->bookingPayload(
            '2026-11-02',
            '2026-11-02',
            '12:15',
            '12:45'
        );

        $this->postJson('/api/bookings', $payload)
            ->assertStatus(409)
            ->assertJsonPath('conflict', true)
            ->assertJsonPath('conflict_type', 'pending')
            ->assertJsonPath('pending_conflicts_required', true)
            ->assertJsonPath('pending_conflicts.0.name', $this->resource->name)
            ->assertJsonPath('suggestions.0.start_time', '2026-11-02 12:30:00')
            ->assertJsonPath('suggestions.0.end_time', '2026-11-02 13:00:00')
            ->assertJsonPath('suggestions.0.label', 'Same day, later slot');

        $this->postJson('/api/bookings', array_merge($payload, [
            'accept_pending_conflicts' => true,
        ]))->assertCreated();

        $this->assertDatabaseCount('booking_request', 2);
    }

    public function test_approved_booking_overlap_cannot_be_overridden_by_pending_conflict_confirmation(): void
    {
        $this->createBooking('approved', '2026-11-02', '2026-11-02', '08:00', '12:00');

        $this->postJson('/api/bookings', array_merge(
            $this->bookingPayload('2026-11-02', '2026-11-02', '08:00', '09:00'),
            ['accept_pending_conflicts' => true]
        ))
            ->assertStatus(409)
            ->assertJsonPath('conflict_type', 'approved')
            ->assertJsonPath('pending_conflicts_required', false);

        $this->assertDatabaseCount('booking_request', 1);
    }

    public function test_direct_approval_cannot_override_a_pending_booking_overlap(): void
    {
        $this->createBooking('pending', '2026-11-02', '2026-11-02', '08:00', '12:00');

        $this->postJson('/api/bookings', array_merge(
            $this->bookingPayload('2026-11-02', '2026-11-02', '08:00', '09:00'),
            [
                'status' => 'approved',
                'accept_pending_conflicts' => true,
            ]
        ))
            ->assertStatus(409)
            ->assertJsonPath('conflict_type', 'pending');

        $this->assertDatabaseCount('booking_request', 1);
    }

    public function test_approving_one_pending_booking_does_not_get_blocked_by_another_pending_booking(): void
    {
        $request = $this->createBooking('pending', '2026-11-02', '2026-11-02', '08:00', '12:00');
        $this->createBooking('pending', '2026-11-02', '2026-11-02', '09:00', '11:00');
        $admin = $this->createAdmin();
        Sanctum::actingAs($admin);

        $this->patchJson("/api/bookings/{$request->booking_id}/status", [
            'status' => 'approved',
        ])->assertOk();

        $this->assertDatabaseHas('booking_request', [
            'booking_id' => $request->booking_id,
            'status' => 'approved',
        ]);
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

    private function createAdmin(): User
    {
        return User::create([
            'full_name' => 'Booking Test Admin',
            'email' => 'booking-admin@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'admin',
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
