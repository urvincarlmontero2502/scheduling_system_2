<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class GoogleRegistrationSqliteTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('google_oauth_temp_tokens');
        Schema::dropIfExists('registration_requests');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('barangays');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email');
            $table->string('password_hash');
            $table->string('role');
            $table->timestamp('deleted_at')->nullable();
        });

        Schema::create('registration_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->string('full_name');
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('google_id')->nullable();
            $table->string('avatar')->nullable();
            $table->string('barangay');
            $table->string('department')->nullable();
            $table->string('role')->default('staff');
            $table->string('status')->default('pending');
            $table->text('reject_reason')->nullable();
            $table->unsignedBigInteger('reviewed_by')->nullable();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('google_oauth_temp_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('token')->unique();
            $table->string('email')->unique();
            $table->string('google_id')->nullable();
            $table->string('full_name')->nullable();
            $table->string('avatar')->nullable();
            $table->timestamp('expires_at');
            $table->timestamps();
        });

        Schema::create('barangays', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
        });
        DB::table('barangays')->insert(['name' => 'Poblacion']);

        DB::table('google_oauth_temp_tokens')->insert([
            'token' => 'sqlite-google-registration-token',
            'email' => 'new-user@example.test',
            'google_id' => 'google-user-id',
            'full_name' => 'New Google User',
            'avatar' => null,
            'expires_at' => now()->addMinutes(15),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_google_registration_schema_checks_work_with_sqlite(): void
    {
        $this->withSession([
            'google_registration_token' => 'sqlite-google-registration-token',
        ])->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/auth/google/complete-registration', [
            'barangay' => 'Poblacion',
        ])
            ->assertCreated()
            ->assertJsonMissingPath('temporary_token')
            ->assertJsonPath('status', 'pending');

        $this->assertDatabaseHas('registration_requests', [
            'email' => 'new-user@example.test',
            'barangay' => 'Poblacion',
            'status' => 'pending',
        ]);
        $this->assertNull(Session::get('google_registration_token'));
    }

    public function test_google_registration_token_is_kept_in_the_server_session(): void
    {
        config([
            'services.google.client_id' => 'google-client',
            'services.google.client_secret' => 'google-secret',
            'services.google.redirect' => 'https://frontend.example.test/auth/google/callback',
        ]);
        Cache::put('google_oauth_state:valid-state', true, now()->addMinutes(10));
        Http::fake([
            'oauth2.googleapis.com/token' => Http::response([
                'access_token' => 'google-access-token',
            ]),
            'www.googleapis.com/oauth2/v2/userinfo' => Http::response([
                'id' => 'google-user-id',
                'email' => 'new-user@example.test',
                'name' => 'New Google User',
            ]),
        ]);

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/auth/google/callback', [
            'code' => 'one-time-code',
            'state' => 'valid-state',
        ])->assertOk()
            ->assertJsonPath('requires_barangay_setup', true)
            ->assertJsonMissingPath('temporary_token');

        $token = Session::get('google_registration_token');
        $this->assertNotEmpty($token);
        $this->assertDatabaseHas('google_oauth_temp_tokens', [
            'token' => $token,
            'email' => 'new-user@example.test',
        ]);
    }

    public function test_password_registration_creates_a_hashed_pending_staff_request(): void
    {
        $this->postJson('/api/registration-requests', [
            'first_name' => 'Alex',
            'middle_name' => 'Maria',
            'last_name' => 'Rivers',
            'email' => 'ALEX.RIVERS@example.test',
            'password' => 'StrongPassword123!',
            'password_confirmation' => 'StrongPassword123!',
            'barangay' => 'Poblacion',
            'role' => 'admin',
        ])
            ->assertCreated()
            ->assertJsonPath('status', 'pending');

        $registration = DB::table('registration_requests')
            ->where('email', 'alex.rivers@example.test')
            ->first();

        $this->assertNotNull($registration);
        $this->assertSame('Alex Maria Rivers', $registration->full_name);
        $this->assertSame('staff', $registration->role);
        $this->assertSame('pending', $registration->status);
        $this->assertTrue(Hash::check('StrongPassword123!', $registration->password_hash));
        $this->assertNotSame('StrongPassword123!', $registration->password_hash);
    }

    public function test_password_registration_rejects_duplicate_pending_requests(): void
    {
        $payload = [
            'first_name' => 'Alex',
            'last_name' => 'Rivers',
            'email' => 'alex.rivers@example.test',
            'password' => 'StrongPassword123!',
            'password_confirmation' => 'StrongPassword123!',
            'barangay' => 'Poblacion',
        ];

        $this->postJson('/api/registration-requests', $payload)->assertCreated();
        $this->postJson('/api/registration-requests', $payload)
            ->assertStatus(409)
            ->assertJsonPath(
                'message',
                'A registration request for this email is already pending approval.'
            );
    }

    public function test_password_registration_validates_password_confirmation(): void
    {
        $this->postJson('/api/registration-requests', [
            'first_name' => 'Alex',
            'last_name' => 'Rivers',
            'email' => 'alex.rivers@example.test',
            'password' => 'StrongPassword123!',
            'password_confirmation' => 'DifferentPassword123!',
            'barangay' => 'Poblacion',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');
    }

    public function test_diagnostic_endpoints_are_not_public_and_health_response_is_minimal(): void
    {
        $this->getJson('/api/diagnostics/oauth-schema')->assertUnauthorized();
        $this->getJson('/api/diagnostics/oauth-tokens')->assertMethodNotAllowed();
        $this->postJson('/api/diagnostics/oauth-tokens')->assertUnauthorized();

        $this->getJson('/api/health')
            ->assertOk()
            ->assertJsonStructure(['api', 'database'])
            ->assertJsonMissingPath('user_columns')
            ->assertJsonMissingPath('missing_columns')
            ->assertJsonMissingPath('personal_access_tokens_table');
    }

    public function test_notification_booking_id_migration_allows_null_on_sqlite(): void
    {
        Schema::create('notifications', function (Blueprint $table) {
            $table->id('notif_id');
            $table->unsignedBigInteger('booking_id');
            $table->unsignedBigInteger('user_id');
            $table->text('message');
            $table->string('type');
            $table->string('title');
            $table->boolean('is_read')->default(false);
            $table->timestamp('created_at')->nullable();
        });

        $migration = require database_path(
            'migrations/2026_11_12_000001_make_notification_booking_nullable_on_sqlite.php'
        );
        $migration->up();

        $bookingColumn = collect(DB::select('PRAGMA table_info(notifications)'))
            ->firstWhere('name', 'booking_id');

        $this->assertSame(0, (int) $bookingColumn->notnull);

        DB::table('notifications')->insert([
            'booking_id' => null,
            'user_id' => 1,
            'message' => 'Registration request',
            'type' => 'registration_request',
            'title' => 'New Registration Request',
            'is_read' => false,
            'created_at' => now(),
        ]);

        $this->assertDatabaseHas('notifications', [
            'booking_id' => null,
            'type' => 'registration_request',
        ]);
    }
}
