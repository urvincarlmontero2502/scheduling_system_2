<?php

namespace Tests\Feature;

use App\Models\BookingRemovalRequest;
use App\Models\BookingRequest;
use App\Models\Resource;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingRemovalRequestTest extends TestCase
{
    private User $staff;

    private User $barangayAdmin;

    private User $otherBarangayAdmin;

    private Resource $resource;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['notifications', 'booking_removal_requests', 'activity_logs', 'booking_request', 'resources', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email');
            $table->string('password_hash');
            $table->string('role');
            $table->string('barangay')->nullable();
        });
        Schema::create('resources', function (Blueprint $table) {
            $table->id('resource_id');
            $table->string('name');
            $table->string('type')->default('facility');
            $table->string('status')->default('available');
            $table->unsignedInteger('buffer_minutes')->default(30);
        });
        Schema::create('booking_request', function (Blueprint $table) {
            $table->id('booking_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('resource_id');
            $table->string('status');
            $table->date('start_date');
            $table->date('end_date');
            $table->string('start_time')->nullable();
            $table->string('end_time')->nullable();
            $table->boolean('is_special_event')->default(false);
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('booking_removal_requests', function (Blueprint $table) {
            $table->bigIncrements('removal_request_id');
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('requested_by');
            $table->string('requester_name');
            $table->string('requester_role');
            $table->text('reason')->nullable();
            $table->json('booking_snapshot');
            $table->string('status')->default('pending');
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->text('review_note')->nullable();
            $table->timestamp('requested_at');
            $table->timestamp('reviewed_at')->nullable();
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
        Schema::create('notifications', function (Blueprint $table) {
            $table->bigIncrements('notif_id');
            $table->unsignedBigInteger('booking_id')->nullable();
            $table->unsignedBigInteger('user_id');
            $table->text('message');
            $table->boolean('is_read')->default(false);
            $table->string('type')->nullable();
            $table->string('title')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        $this->staff = $this->createUser('staff', 'Poblacion');
        $this->barangayAdmin = $this->createUser('barangay_admin', 'Poblacion');
        $this->otherBarangayAdmin = $this->createUser('barangay_admin', 'Bunga');
        $this->resource = Resource::create(['name' => 'Conference Room']);
    }

    public function test_staff_can_request_removal_of_their_pending_booking_and_duplicate_pending_requests_are_rejected(): void
    {
        $booking = $this->createBooking($this->staff, 'pending');
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/bookings/{$booking->booking_id}/removal-request")
            ->assertCreated()
            ->assertJsonPath('status', 'pending');

        $this->postJson("/api/bookings/{$booking->booking_id}/removal-request")
            ->assertUnprocessable();

        $this->assertDatabaseCount('booking_removal_requests', 1);
        $this->assertDatabaseHas('notifications', [
            'user_id' => $this->barangayAdmin->user_id,
            'type' => 'BOOKING_REMOVAL_REQUEST',
        ]);
    }

    public function test_staff_cannot_request_removal_of_another_users_booking(): void
    {
        $otherStaff = $this->createUser('staff', 'Poblacion');
        $booking = $this->createBooking($otherStaff, 'approved');
        Sanctum::actingAs($this->staff);

        $this->postJson("/api/bookings/{$booking->booking_id}/removal-request")
            ->assertForbidden();
    }

    public function test_barangay_admin_can_approve_own_barangays_request_but_other_barangay_admin_cannot(): void
    {
        $booking = $this->createBooking($this->staff, 'approved');
        $removalRequest = BookingRemovalRequest::create([
            'booking_id' => $booking->booking_id,
            'requested_by' => $this->staff->user_id,
            'requester_name' => $this->staff->full_name,
            'requester_role' => 'staff',
            'booking_snapshot' => ['resource_name' => $this->resource->name],
            'status' => 'pending',
            'requested_at' => now(),
        ]);

        Sanctum::actingAs($this->otherBarangayAdmin);
        $this->postJson("/api/booking-removal-requests/{$removalRequest->removal_request_id}/approve")
            ->assertForbidden();

        Sanctum::actingAs($this->barangayAdmin);
        $this->postJson("/api/booking-removal-requests/{$removalRequest->removal_request_id}/approve")
            ->assertOk();

        $this->assertDatabaseHas('booking_request', [
            'booking_id' => $booking->booking_id,
        ]);
        $this->assertNotNull($booking->fresh()->deleted_at);
        $this->assertSame(0, BookingRequest::query()->count());
        $this->assertDatabaseHas('booking_removal_requests', [
            'removal_request_id' => $removalRequest->removal_request_id,
            'status' => 'approved',
        ]);
    }

    public function test_barangay_admin_cannot_directly_remove_an_approved_booking_from_another_barangay(): void
    {
        $otherStaff = $this->createUser('staff', 'Bunga');
        $booking = $this->createBooking($otherStaff, 'approved');
        Sanctum::actingAs($this->barangayAdmin);

        $this->deleteJson("/api/bookings/{$booking->booking_id}")
            ->assertForbidden();
    }

    public function test_barangay_admin_can_directly_remove_an_approved_booking_from_their_barangay(): void
    {
        $booking = $this->createBooking($this->staff, 'approved');
        Sanctum::actingAs($this->barangayAdmin);

        $this->deleteJson("/api/bookings/{$booking->booking_id}")
            ->assertOk();

        $this->assertNotNull($booking->fresh()->deleted_at);
    }

    public function test_barangay_admin_can_directly_remove_a_pending_booking_from_their_barangay(): void
    {
        $booking = $this->createBooking($this->staff, 'pending');
        Sanctum::actingAs($this->barangayAdmin);

        $this->deleteJson("/api/bookings/{$booking->booking_id}")
            ->assertOk();

        $this->assertNotNull($booking->fresh()->deleted_at);
    }

    public function test_barangay_admin_cannot_directly_remove_a_pending_booking_from_another_barangay(): void
    {
        $otherStaff = $this->createUser('staff', 'Bunga');
        $booking = $this->createBooking($otherStaff, 'pending');
        Sanctum::actingAs($this->barangayAdmin);

        $this->deleteJson("/api/bookings/{$booking->booking_id}")
            ->assertForbidden();
    }

    public function test_removed_booking_list_is_scoped_to_the_authenticated_user_and_barangay(): void
    {
        $owned = $this->createBooking($this->staff, 'approved');
        $other = $this->createBooking($this->createUser('staff', 'Bunga'), 'pending');
        $owned->delete();
        $other->delete();

        Sanctum::actingAs($this->staff);
        $this->getJson('/api/bookings/removed')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $owned->booking_id);

        Sanctum::actingAs($this->barangayAdmin);
        $this->getJson('/api/bookings/removed')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.id', $owned->booking_id);
    }

    public function test_only_admins_and_barangay_admins_can_restore_and_barangay_admins_are_scoped(): void
    {
        $owned = $this->createBooking($this->staff, 'approved');
        $other = $this->createBooking($this->createUser('staff', 'Bunga'), 'approved');
        $owned->delete();
        $other->delete();

        Sanctum::actingAs($this->staff);
        $this->postJson("/api/bookings/{$owned->booking_id}/restore")->assertForbidden();

        Sanctum::actingAs($this->otherBarangayAdmin);
        $this->postJson("/api/bookings/{$owned->booking_id}/restore")->assertForbidden();

        Sanctum::actingAs($this->barangayAdmin);
        $this->postJson("/api/bookings/{$owned->booking_id}/restore")->assertOk();
        $this->assertNull($owned->fresh()->deleted_at);
        $this->assertSame(1, BookingRequest::query()->count());
    }

    public function test_conflicting_pending_or_approved_booking_cannot_be_restored(): void
    {
        $removed = $this->createBooking($this->staff, 'approved');
        $removed->delete();
        $this->createBooking($this->staff, 'approved');
        Sanctum::actingAs($this->barangayAdmin);

        $this->postJson("/api/bookings/{$removed->booking_id}/restore")
            ->assertStatus(409)
            ->assertJsonPath('message', 'This booking cannot be restored because it conflicts with another active booking.');

        $this->assertNotNull($removed->fresh()->deleted_at);
    }

    private function createUser(string $role, string $barangay): User
    {
        $number = User::count() + 1;

        return User::create([
            'full_name' => ucfirst($role).' '.$barangay,
            'email' => strtolower($role).'.'.str_replace(' ', '', strtolower($barangay)).$number.'@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => $role,
            'barangay' => $barangay,
        ]);
    }

    private function createBooking(User $owner, string $status): BookingRequest
    {
        return BookingRequest::create([
            'user_id' => $owner->user_id,
            'resource_id' => $this->resource->resource_id,
            'status' => $status,
            'start_date' => '2026-11-15',
            'end_date' => '2026-11-15',
            'is_special_event' => false,
        ]);
    }
}
