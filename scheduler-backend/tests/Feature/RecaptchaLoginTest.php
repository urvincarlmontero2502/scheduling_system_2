<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Client\Request;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RecaptchaLoginTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->boolean('password_setup_required')->default(false);
            $table->string('role')->default('staff');
            $table->string('google_id')->nullable();
            $table->string('remember_token')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
    }

    public function test_login_requires_a_recaptcha_token(): void
    {
        config(['recaptcha.secret' => 'test-secret']);
        Http::fake();

        $this->postJson('/api/login', [
            'email' => 'user@example.com',
            'password' => 'password',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors('recaptcha_token');

        Http::assertNothingSent();
    }

    public function test_login_rejects_a_low_recaptcha_score_before_authentication(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        config(['recaptcha.secret' => 'test-secret']);
        Http::fake([
            'www.google.com/recaptcha/api/siteverify' => Http::response([
                'success' => true,
                'score' => 0.2,
                'action' => 'login',
                'hostname' => 'localhost',
            ]),
        ]);
        Auth::shouldReceive('guard')->never();

        $this->postJson('/api/login', [
            'email' => 'user@example.com',
            'password' => 'password',
            'recaptcha_token' => 'one-time-token',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'reCAPTCHA verification failed. Please try again.');
    }

    public function test_login_rejects_recaptcha_for_a_different_action_or_hostname(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        config([
            'recaptcha.secret' => 'test-secret',
            'recaptcha.allowed_hostnames' => ['scheduler.example'],
        ]);
        Http::fake([
            'www.google.com/recaptcha/api/siteverify' => Http::response([
                'success' => true,
                'score' => 0.9,
                'action' => 'signup',
                'hostname' => 'attacker.example',
            ]),
        ]);
        Auth::shouldReceive('guard')->never();

        $this->postJson('/api/login', [
            'email' => 'user@example.com',
            'password' => 'password',
            'recaptcha_token' => 'one-time-token',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'reCAPTCHA verification failed. Please try again.');
    }

    public function test_successful_recaptcha_allows_case_insensitive_login_without_forwarding_the_token(): void
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        DB::table('users')->insert([
            'full_name' => 'Test User',
            'email' => 'User@Example.com',
            'password_hash' => Hash::make('password'),
            'role' => 'staff',
        ]);
        config([
            'recaptcha.secret' => 'test-secret',
            'recaptcha.allowed_hostnames' => ['localhost'],
        ]);
        Http::fake([
            'www.google.com/recaptcha/api/siteverify' => Http::response([
                'success' => true,
                'score' => 0.9,
                'action' => 'login',
                'hostname' => 'localhost',
            ]),
        ]);
        $this->withHeaders([
            'Origin' => 'http://localhost:5173',
            'Referer' => 'http://localhost:5173/',
        ])->postJson('/api/login', [
            'email' => 'user@example.com',
            'password' => 'password',
            'recaptcha_token' => 'one-time-token',
        ])->assertOk()
            ->assertJsonPath('user.email', 'User@Example.com')
            ->assertJsonMissingPath('token');

        Http::assertSent(fn (Request $request) => $request->url() === 'https://www.google.com/recaptcha/api/siteverify'
            && $request['secret'] === 'test-secret'
            && $request['response'] === 'one-time-token');
    }

    public function test_login_fails_closed_when_recaptcha_is_not_configured(): void
    {
        config(['recaptcha.secret' => null]);
        Http::fake();

        $this->postJson('/api/login', [
            'email' => 'user@example.com',
            'password' => 'password',
            'recaptcha_token' => 'one-time-token',
        ])->assertStatus(503)
            ->assertJsonPath(
                'message',
                'Sign-in protection is not configured. Please contact the system administrator.'
            );

        Http::assertNothingSent();
    }
}
