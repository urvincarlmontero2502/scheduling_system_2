<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SessionAuthenticationTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email')->nullable()->unique();
            $table->string('cell_number')->nullable()->unique();
            $table->string('password_hash');
            $table->boolean('password_setup_required')->default(false);
            $table->string('role')->default('staff');
            $table->string('google_id')->nullable();
            $table->string('remember_token')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });

        $userId = DB::table('users')->insertGetId([
            'full_name' => 'Test Applicant',
            'email' => 'applicant@example.test',
            'password_hash' => Hash::make('correct-password'),
            'role' => 'staff',
        ], 'user_id');
        $this->user = User::findOrFail($userId);

        config([
            'recaptcha.secret' => 'test-secret',
            'recaptcha.allowed_hostnames' => ['localhost'],
            'session.secure' => true,
            'session.http_only' => true,
            'session.same_site' => 'lax',
        ]);
        Http::fake([
            'www.google.com/recaptcha/api/siteverify' => Http::response([
                'success' => true,
                'score' => 0.9,
                'action' => 'login',
                'hostname' => 'localhost',
            ]),
        ]);
    }

    public function test_login_persists_a_session_without_returning_a_bearer_token(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/login', [
            'email' => 'applicant@example.test',
            'password' => 'correct-password',
            'remember_me' => false,
            'recaptcha_token' => 'valid-recaptcha-token',
        ]);
        $response->assertOk()
            ->assertJsonPath('user.email', 'applicant@example.test')
            ->assertJsonMissingPath('token')
            ->assertCookie(config('session.cookie'));

        $sessionCookie = collect($response->headers->getCookies())
            ->first(fn ($cookie) => $cookie->getName() === config('session.cookie'));
        $this->assertNotNull($sessionCookie);
        $this->assertTrue($sessionCookie->isHttpOnly());
        $this->assertTrue($sessionCookie->isSecure());
        $this->assertSame('lax', $sessionCookie->getSameSite());

        $this->assertAuthenticatedAs($this->user);

        Auth::forgetGuards();
        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('email', 'applicant@example.test');

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/logout')->assertOk();

        $this->assertGuest('web');
        Auth::forgetGuards();
        $this->getJson('/api/user')
            ->assertOk()
            ->assertContent('null');
    }

    public function test_login_accepts_a_normalized_cell_number_identifier(): void
    {
        $this->user->cell_number = '09171234567';
        $this->user->email = null;
        $this->user->save();

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/login', [
            'identifier' => '+63 917-123-4567',
            'password' => 'correct-password',
            'remember_me' => false,
            'recaptcha_token' => 'valid-recaptcha-token',
        ])->assertOk()
            ->assertJsonPath('user.cell_number', '09171234567')
            ->assertJsonPath('user.email', null);
    }

    public function test_remember_me_uses_a_limited_remember_cookie(): void
    {
        $response = $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/login', [
            'email' => 'applicant@example.test',
            'password' => 'correct-password',
            'remember_me' => true,
            'recaptcha_token' => 'valid-recaptcha-token',
        ])->assertOk()
            ->assertJsonMissingPath('token');

        $this->assertNotNull($this->user->fresh()->getRememberToken());
        $rememberCookie = collect($response->headers->getCookies())
            ->first(fn ($cookie) => str_starts_with($cookie->getName(), 'remember_web_'));
        $this->assertNotNull($rememberCookie);
        $this->assertGreaterThan(
            now()->addDays(29)->getTimestamp(),
            $rememberCookie->getExpiresTime()
        );
    }

    public function test_google_password_setup_can_be_used_to_log_in_with_email_case_insensitively(): void
    {
        $this->user->password_hash = Hash::make('random-google-password');
        $this->user->password_setup_required = true;
        $this->user->save();
        Auth::guard('web')->login($this->user);

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->putJson('/api/user/password', [
            'password' => 'GoogleFallbackPass123!',
            'password_confirmation' => 'GoogleFallbackPass123!',
        ])->assertOk();

        Auth::guard('web')->logout();
        Auth::forgetGuards();
        Auth::shouldUse('web');

        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/login', [
            'email' => 'APPLICANT@EXAMPLE.TEST',
            'password' => 'GoogleFallbackPass123!',
            'remember_me' => false,
            'recaptcha_token' => 'valid-recaptcha-token',
        ])->assertOk()
            ->assertJsonPath('user.email', 'applicant@example.test');
    }

    public function test_google_login_establishes_a_cookie_session_without_returning_a_token(): void
    {
        $this->assertDatabaseHas('users', ['email' => 'applicant@example.test']);
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
                'email' => 'applicant@example.test',
                'name' => 'Test Applicant',
            ]),
        ]);

        $response = $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/auth/google/callback', [
            'code' => 'one-time-code',
            'state' => 'valid-state',
        ]);
        $this->assertSame(200, $response->status(), $response->getContent());
        $response
            ->assertJsonPath('user.email', 'applicant@example.test')
            ->assertJsonMissingPath('token')
            ->assertCookie(config('session.cookie'));

        $this->assertAuthenticatedAs($this->user);
        $this->assertNotNull($this->user->fresh()->getRememberToken());
        $this->assertNotEmpty($response->headers->get('Set-Cookie'));

        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('can_set_password_without_current', true);
        $this->putJson('/api/user/password', [
            'password' => 'GoogleFallbackPass123!',
            'password_confirmation' => 'GoogleFallbackPass123!',
        ])->assertOk();
        $this->assertTrue(Hash::check(
            'GoogleFallbackPass123!',
            $this->user->fresh()->password_hash
        ));
        $this->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('can_set_password_without_current', false);
    }
}
