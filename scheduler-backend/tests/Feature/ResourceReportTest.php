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

class ResourceReportTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('booking_vehicles');
        Schema::dropIfExists('booking_request');
        Schema::dropIfExists('resources');
        Schema::dropIfExists('users');

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
            $table->string('type');
            $table->string('status')->default('available');
            $table->unsignedInteger('buffer_minutes')->default(30);
            $table->decimal('price_per_day', 10, 2)->nullable();
            $table->decimal('price_per_hour', 10, 2)->nullable();
            $table->timestamp('deleted_at')->nullable();
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
            $table->string('status')->default('pending');
            $table->boolean('is_special_event')->default(false);
            $table->decimal('price_per_day', 10, 2)->nullable();
            $table->decimal('price_per_hour', 10, 2)->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('booking_vehicles', function (Blueprint $table) {
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('resource_id');
            $table->decimal('price_per_hour', 10, 2)->nullable();
            $table->primary(['booking_id', 'resource_id']);
        });

        $this->admin = $this->makeUser('admin', 'Admin');
        Sanctum::actingAs($this->admin);
        Carbon::setTestNow(Carbon::parse('2026-11-17 10:00:00', 'Asia/Manila'));
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();
        parent::tearDown();
    }

    public function test_facility_report_counts_statuses_and_assesses_only_approved_usage(): void
    {
        $facility = $this->makeResource('facility', 'Municipal Gymnasium', 1500);
        $this->makeBooking($facility, $this->admin, 'approved', '2026-11-03', '2026-11-05');
        $this->makeBooking($facility, $this->admin, 'pending', '2026-11-10', '2026-11-10');
        $this->makeBooking($facility, $this->admin, 'rejected', '2026-11-12', '2026-11-12');
        $removed = $this->makeBooking($facility, $this->admin, 'approved', '2026-11-14', '2026-11-14');
        $removed->delete();

        $this->getJson('/api/reports?resource_id='.$facility->resource_id.'&period=month')
            ->assertOk()
            ->assertJsonPath('meta.resource.name', 'Municipal Gymnasium')
            ->assertJsonPath('meta.start_date', '2026-11-01')
            ->assertJsonPath('meta.end_date', '2026-11-30')
            ->assertJsonPath('meta.payment_tracking_available', false)
            ->assertJsonPath('summary.total_bookings', 4)
            ->assertJsonPath('summary.approved_bookings', 1)
            ->assertJsonPath('summary.pending_bookings', 1)
            ->assertJsonPath('summary.rejected_bookings', 1)
            ->assertJsonPath('summary.cancelled_bookings', 1)
            ->assertJsonPath('summary.total_usage_days', 3)
            ->assertJsonPath('summary.estimated_assessed_amount', 4500)
            ->assertJsonPath('summary.amount_paid', null)
            ->assertJsonPath('summary.outstanding_balance', null)
            ->assertJsonPath('bookings.0.estimated_amount', 4500)
            ->assertJsonPath('bookings.0.resource_assignments.0.rate_unit', 'day');
    }

    public function test_multiple_vehicles_count_as_one_booking_and_individual_resource_assignments(): void
    {
        $navara = $this->makeResource('vehicle', 'Nissan Navara', null, 100);
        $van = $this->makeResource('vehicle', 'HiAce Van #1', null, 150);
        $booking = $this->makeBooking($navara, $this->admin, 'approved', '2026-11-17', '2026-11-17', [
            'start_time' => '08:15',
            'end_time' => '09:45',
            'price_per_hour' => 100,
        ]);
        $booking->vehicles()->attach([
            $navara->resource_id => ['price_per_hour' => 100],
            $van->resource_id => ['price_per_hour' => 150],
        ]);
        $this->makeBooking($navara, $this->admin, 'pending', '2026-11-18', '2026-11-18');

        $this->getJson('/api/reports?resource_type=vehicle&period=month')
            ->assertOk()
            ->assertJsonPath('summary.total_bookings', 2)
            ->assertJsonPath('summary.resource_assignments', 3)
            ->assertJsonPath('summary.estimated_assessed_amount', 500)
            ->assertJsonPath('summary.total_usage_hours', 3)
            ->assertJsonPath('summary.average_duration_hours', 1.5)
            ->assertJsonPath('bookings.0.resource_names', ['Nissan Navara', 'HiAce Van #1'])
            ->assertJsonPath('bookings.0.estimated_amount', 500);

        $this->getJson('/api/reports?resource_id='.$van->resource_id.'&period=month')
            ->assertOk()
            ->assertJsonPath('summary.total_bookings', 1)
            ->assertJsonPath('summary.resource_assignments', 1)
            ->assertJsonPath('summary.estimated_assessed_amount', 300)
            ->assertJsonPath('bookings.0.resource_names', ['HiAce Van #1']);
    }

    public function test_unpriced_approved_bookings_are_marked_for_assessment(): void
    {
        $facility = $this->makeResource('facility', 'Unpriced Hall');
        $this->makeBooking($facility, $this->admin, 'approved', '2026-11-17', '2026-11-17');

        $this->getJson('/api/reports?resource_id='.$facility->resource_id.'&period=month')
            ->assertOk()
            ->assertJsonPath('summary.estimated_assessed_amount', 0)
            ->assertJsonPath('summary.amount_is_complete', false)
            ->assertJsonPath('summary.unassessed_successful_assignments', 1)
            ->assertJsonPath('bookings.0.estimated_amount', null)
            ->assertJsonPath('bookings.0.amount_status', 'for_assessment');
    }

    public function test_zero_hour_vehicle_booking_is_not_reported_as_assessed_amount(): void
    {
        $vehicle = $this->makeResource('vehicle', 'Utility Van', null, 100);
        $this->makeBooking($vehicle, $this->admin, 'approved', '2026-11-17', '2026-11-17', [
            'start_time' => '08:00',
            'end_time' => '08:00',
        ]);

        $this->getJson('/api/reports?resource_id='.$vehicle->resource_id.'&period=month')
            ->assertOk()
            ->assertJsonPath('summary.amount_is_complete', false)
            ->assertJsonPath('bookings.0.estimated_amount', null)
            ->assertJsonPath('bookings.0.amount_status', 'for_assessment');
    }

    public function test_resource_with_no_bookings_returns_zero_totals_and_an_empty_booking_list(): void
    {
        $facility = $this->makeResource('facility', 'Unused Room', 1000);

        $this->getJson('/api/reports?resource_id='.$facility->resource_id.'&period=month')
            ->assertOk()
            ->assertJsonPath('summary.total_bookings', 0)
            ->assertJsonPath('summary.resource_assignments', 0)
            ->assertJsonPath('summary.estimated_assessed_amount', 0)
            ->assertJsonPath('summary.amount_is_complete', true)
            ->assertJsonCount(0, 'bookings')
            ->assertJsonCount(6, 'breakdown');
    }

    public function test_period_presets_and_custom_date_range_are_resolved_in_manila_time(): void
    {
        $facility = $this->makeResource('facility', 'Meeting Room', 1000);
        $this->makeBooking($facility, $this->admin, 'approved', '2026-11-16', '2026-11-16');

        $this->getJson('/api/reports?period=week')
            ->assertOk()
            ->assertJsonPath('meta.start_date', '2026-11-16')
            ->assertJsonPath('meta.end_date', '2026-11-22')
            ->assertJsonPath('meta.grouping', 'day')
            ->assertJsonCount(7, 'breakdown');

        $this->getJson('/api/reports?period=month')
            ->assertOk()
            ->assertJsonPath('meta.start_date', '2026-11-01')
            ->assertJsonPath('meta.end_date', '2026-11-30')
            ->assertJsonPath('meta.grouping', 'week');

        $this->getJson('/api/reports?period=year')
            ->assertOk()
            ->assertJsonPath('meta.start_date', '2026-01-01')
            ->assertJsonPath('meta.end_date', '2026-12-31')
            ->assertJsonPath('meta.grouping', 'month')
            ->assertJsonCount(12, 'breakdown');

        $this->getJson('/api/reports?period=custom&start_date=2026-11-15&end_date=2026-11-17')
            ->assertOk()
            ->assertJsonPath('meta.start_date', '2026-11-15')
            ->assertJsonPath('meta.end_date', '2026-11-17')
            ->assertJsonPath('meta.grouping', 'day');
    }

    public function test_report_visibility_matches_admin_barangay_admin_and_staff_scopes(): void
    {
        $facility = $this->makeResource('facility', 'Municipal Gymnasium', 1000);
        $poblacionStaff = $this->makeUser('staff', 'Poblacion Staff', 'Poblacion');
        $otherStaff = $this->makeUser('staff', 'Other Staff', 'San Roque');
        $this->makeBooking($facility, $poblacionStaff, 'approved', '2026-11-17', '2026-11-17');
        $this->makeBooking($facility, $otherStaff, 'approved', '2026-11-17', '2026-11-17');
        $specialEvent = $this->makeBooking($facility, $otherStaff, 'approved', '2026-11-17', '2026-11-17');
        $specialEvent->update(['is_special_event' => true]);

        $barangayAdmin = $this->makeUser('barangay_admin', 'Barangay Admin', 'Poblacion');
        Sanctum::actingAs($barangayAdmin);
        $this->getJson('/api/reports?period=month')
            ->assertOk()
            ->assertJsonPath('summary.total_bookings', 2);

        Sanctum::actingAs($poblacionStaff);
        $this->getJson('/api/reports?period=month')
            ->assertOk()
            ->assertJsonPath('summary.total_bookings', 1);

        Sanctum::actingAs($this->admin);
        $this->getJson('/api/reports?period=month')
            ->assertOk()
            ->assertJsonPath('summary.total_bookings', 3);

        Sanctum::actingAs($this->makeUser('user', 'Regular Requestor'));
        $this->getJson('/api/reports?period=month')
            ->assertForbidden();
    }

    private function makeUser(string $role, string $name, ?string $barangay = null): User
    {
        static $userNumber = 0;
        $userNumber++;

        return User::create([
            'full_name' => $name,
            'email' => "report-user-{$userNumber}@example.test",
            'password_hash' => 'not-a-real-password',
            'role' => $role,
            'barangay' => $barangay,
        ]);
    }

    private function makeResource(
        string $type,
        string $name,
        ?float $pricePerDay = null,
        ?float $pricePerHour = null
    ): Resource {
        return Resource::create([
            'name' => $name,
            'type' => $type,
            'status' => 'available',
            'price_per_day' => $pricePerDay,
            'price_per_hour' => $pricePerHour,
        ]);
    }

    private function makeBooking(
        Resource $resource,
        User $user,
        string $status,
        string $startDate,
        string $endDate,
        array $overrides = []
    ): BookingRequest {
        return BookingRequest::create([
            'user_id' => $user->user_id,
            'resource_id' => $resource->resource_id,
            'reference_id' => 'JBG-2026-'.str_pad((string) (BookingRequest::withTrashed()->count() + 1), 4, '0', STR_PAD_LEFT),
            'full_name' => $user->full_name,
            'purpose' => 'Community meeting',
            'start_date' => $startDate,
            'end_date' => $endDate,
            'start_time' => '08:00',
            'end_time' => '10:00',
            'status' => $status,
            'price_per_day' => $resource->type === 'facility' ? $resource->price_per_day : null,
            'price_per_hour' => $resource->type === 'vehicle' ? $resource->price_per_hour : null,
            ...$overrides,
        ]);
    }
}
