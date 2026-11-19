<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ActivityLogTest extends TestCase
{
    private User $admin;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('booking_removal_requests');
        Schema::dropIfExists('booking_request');
        Schema::dropIfExists('registration_requests');
        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email');
            $table->string('password_hash');
            $table->string('role');
            $table->string('barangay')->nullable();
            $table->timestamp('deleted_at')->nullable();
            $table->string('pending_email')->nullable();
            $table->string('email_verification_token')->nullable();
            $table->timestamp('email_verification_sent_at')->nullable();
        });

        Schema::create('booking_request', function (Blueprint $table) {
            $table->id('booking_id');
            $table->unsignedBigInteger('user_id');
        });

        Schema::create('booking_removal_requests', function (Blueprint $table) {
            $table->id('removal_request_id');
            $table->unsignedBigInteger('booking_id');
        });

        Schema::create('registration_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->string('barangay');
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

        $this->admin = User::create([
            'full_name' => 'System Admin',
            'email' => 'admin@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'admin',
        ]);
        $this->user = User::create([
            'full_name' => 'Regular User',
            'email' => 'user@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'user',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_admins_can_search_and_filter_activity_logs_from_the_last_year(): void
    {
        Sanctum::actingAs($this->admin);

        ActivityLog::create([
            'actor_name' => 'System Admin',
            'actor_role' => 'admin',
            'action' => 'booking.approved',
            'subject_type' => 'booking',
            'subject_id' => '42',
            'description' => 'Approved booking #42 for Community Hall.',
            'created_at' => now(),
        ]);
        ActivityLog::create([
            'actor_name' => 'Other Admin',
            'actor_role' => 'admin',
            'action' => 'resource.created',
            'subject_type' => 'resource',
            'subject_id' => '9',
            'description' => 'Added resource Town Hall.',
            'created_at' => now(),
        ]);
        ActivityLog::create([
            'actor_name' => 'System Admin',
            'actor_role' => 'admin',
            'action' => 'booking.approved',
            'subject_type' => 'booking',
            'subject_id' => '3',
            'description' => 'Approved booking #3 for Community Hall.',
            'created_at' => now()->subYear()->subSecond(),
        ]);

        $this->getJson('/api/admin/activity-logs?action=booking.approved&search=Community')
            ->assertOk()
            ->assertJsonPath('total', 1)
            ->assertJsonPath('data.0.action', 'booking.approved')
            ->assertJsonPath('data.0.subject_id', '42');
    }

    public function test_guests_cannot_read_activity_logs(): void
    {
        $this->getJson('/api/admin/activity-logs')->assertUnauthorized();
    }

    public function test_guest_user_lookup_returns_null_without_unauthorized_response(): void
    {
        $this->getJson('/api/user')
            ->assertOk()
            ->assertContent('null');
    }

    public function test_non_admin_users_cannot_read_activity_logs(): void
    {
        Sanctum::actingAs($this->user);

        $this->getJson('/api/admin/activity-logs')->assertForbidden();
    }

    public function test_barangay_admins_only_see_activity_related_to_their_barangay(): void
    {
        $barangayAdmin = User::create([
            'full_name' => 'Poblacion Admin',
            'email' => 'poblacion-admin@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'barangay_admin',
            'barangay' => 'Poblacion',
        ]);
        $localStaff = User::create([
            'full_name' => 'Poblacion Staff',
            'email' => 'poblacion-staff@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'staff',
            'barangay' => 'Poblacion',
        ]);
        $otherStaff = User::create([
            'full_name' => 'Other Barangay Staff',
            'email' => 'other-staff@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'staff',
            'barangay' => 'San Jose',
        ]);

        $localBookingId = DB::table('booking_request')->insertGetId([
            'user_id' => $localStaff->user_id,
        ]);
        $otherBookingId = DB::table('booking_request')->insertGetId([
            'user_id' => $otherStaff->user_id,
        ]);
        $localRemovalId = DB::table('booking_removal_requests')->insertGetId([
            'booking_id' => $localBookingId,
        ]);
        $otherRemovalId = DB::table('booking_removal_requests')->insertGetId([
            'booking_id' => $otherBookingId,
        ]);
        $localRegistrationId = DB::table('registration_requests')->insertGetId([
            'barangay' => 'Poblacion',
        ]);
        $otherRegistrationId = DB::table('registration_requests')->insertGetId([
            'barangay' => 'San Jose',
        ]);

        $record = function (
            string $action,
            ?string $subjectType,
            ?string $subjectId,
            string $description,
            ?array $properties = null
        ): void {
            ActivityLog::create([
                'actor_name' => 'System Admin',
                'actor_role' => 'admin',
                'action' => $action,
                'subject_type' => $subjectType,
                'subject_id' => $subjectId,
                'description' => $description,
                'properties' => $properties,
                'created_at' => now(),
            ]);
        };

        $record('booking.approved', 'booking', (string) $localBookingId, 'Local booking approved');
        $record('booking.approved', 'booking', (string) $otherBookingId, 'Other barangay booking approved');
        $record('booking.removal_request_approved', 'booking_removal_request', (string) $localRemovalId, 'Local removal approved');
        $record('booking.removal_request_approved', 'booking_removal_request', (string) $otherRemovalId, 'Other removal approved');
        $record('registration.approved', 'registration', (string) $localRegistrationId, 'Local registration approved');
        $record('registration.approved', 'registration', (string) $otherRegistrationId, 'Other registration approved');
        $record('user.role_promoted', 'user', (string) $localStaff->user_id, 'Local user role updated');
        $record('user.permanently_deleted', 'user', '9001', 'Deleted local user', ['barangay' => 'Poblacion']);
        $record('user.permanently_deleted', 'user', '9002', 'Deleted other user', ['barangay' => 'San Jose']);
        $record('resource.created', 'resource', '10', 'Global resource created');

        Sanctum::actingAs($barangayAdmin);
        $response = $this->getJson('/api/admin/activity-logs')->assertOk();

        $this->assertEqualsCanonicalizing(
            [
                'Local booking approved',
                'Local removal approved',
                'Local registration approved',
                'Local user role updated',
                'Deleted local user',
            ],
            collect($response->json('data'))
                ->pluck('description')
                ->values()
                ->all(),
        );
        $this->assertSame(5, $response->json('total'));
    }

    public function test_user_endpoint_does_not_serialize_email_verification_secrets(): void
    {
        $this->admin->forceFill([
            'pending_email' => 'new@example.test',
            'email_verification_token' => 'verification-token',
            'email_verification_sent_at' => now(),
        ])->save();
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonMissingPath('pending_email')
            ->assertJsonMissingPath('email_verification_token')
            ->assertJsonMissingPath('email_verification_sent_at')
            ->assertJsonMissingPath('password_hash');
    }

    public function test_purge_command_removes_activity_logs_older_than_one_year(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-12 12:00:00'));

        ActivityLog::create([
            'actor_name' => 'System Admin',
            'actor_role' => 'admin',
            'action' => 'booking.approved',
            'description' => 'Recent event',
            'created_at' => now(),
        ]);
        ActivityLog::create([
            'actor_name' => 'System Admin',
            'actor_role' => 'admin',
            'action' => 'booking.approved',
            'description' => 'Expired event',
            'created_at' => now()->subYear()->subSecond(),
        ]);

        Artisan::call('activity-logs:purge-expired');

        $this->assertDatabaseCount('activity_logs', 1);
        $this->assertDatabaseHas('activity_logs', ['description' => 'Recent event']);
    }
}
