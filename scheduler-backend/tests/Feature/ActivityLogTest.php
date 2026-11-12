<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Artisan;
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

        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email');
            $table->string('password_hash');
            $table->string('role');
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

    public function test_authenticated_users_can_search_and_filter_activity_logs_from_the_last_year(): void
    {
        Sanctum::actingAs($this->user);

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
