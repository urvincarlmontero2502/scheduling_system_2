<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class RegistrationStatusVerificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('registration_status_verifications');
        Schema::dropIfExists('registration_requests');
        Schema::create('registration_requests', function (Blueprint $table) {
            $table->id('request_id');
            $table->string('email')->nullable();
            $table->string('cell_number')->nullable();
            $table->string('password_hash')->nullable();
            $table->string('status');
            $table->timestamp('reviewed_at')->nullable();
        });
        Schema::create('registration_status_verifications', function (Blueprint $table) {
            $table->id();
            $table->string('email', 255)->index();
            $table->char('token_hash', 64)->unique();
            $table->timestamp('expires_at')->index();
            $table->timestamp('created_at')->useCurrent();
        });

        DB::table('registration_requests')->insert([
            'email' => 'applicant@example.test',
            'status' => 'pending',
        ]);
    }

    public function test_request_response_does_not_disclose_email_registration_existence(): void
    {
        $tokens = [];
        Mail::shouldReceive('raw')
            ->twice()
            ->withArgs(function ($body, $callback) use (&$tokens) {
                preg_match('/token=([a-f0-9]{64})/', $body, $matches);
                $tokens[] = $matches[1] ?? null;

                return is_callable($callback);
            })
            ->andReturnNull();

        $knownAddress = $this->postJson('/api/registration-lookup', [
            'email' => 'applicant@example.test',
        ]);
        $unknownAddress = $this->postJson('/api/registration-lookup', [
            'email' => 'unknown@example.test',
        ]);

        $expected = [
            'message' => 'If a registration request exists for this address, verification instructions will be sent.',
        ];
        $knownAddress->assertAccepted()->assertExactJson($expected);
        $unknownAddress->assertAccepted()->assertExactJson($expected);
        $this->assertCount(2, $tokens);
        $this->assertNotNull($tokens[0]);
        $this->assertNotNull($tokens[1]);
        $this->assertDatabaseHas('registration_status_verifications', [
            'email' => 'applicant@example.test',
            'token_hash' => hash('sha256', $tokens[0]),
        ]);
        $this->assertDatabaseHas('registration_status_verifications', [
            'email' => 'unknown@example.test',
            'token_hash' => hash('sha256', $tokens[1]),
        ]);
        $this->assertDatabaseMissing('registration_status_verifications', [
            'token_hash' => $tokens[0],
        ]);
    }

    public function test_verified_link_returns_status_once_and_cannot_be_reused(): void
    {
        $token = $this->requestVerificationToken('applicant@example.test');

        $this->postJson('/api/registration-lookup/verify', [
            'email' => 'applicant@example.test',
            'token' => $token,
        ])
            ->assertOk()
            ->assertJsonPath('status', 'pending')
            ->assertJsonMissingPath('email')
            ->assertJsonMissingPath('full_name')
            ->assertJsonMissingPath('password_hash');

        $this->postJson('/api/registration-lookup/verify', [
            'email' => 'applicant@example.test',
            'token' => $token,
        ])
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'This verification link is invalid, expired, or already used. Request a new link.'
            );
    }

    public function test_cell_number_and_registration_password_can_verify_status(): void
    {
            DB::table('registration_requests')->insert([
                'email' => null,
                'cell_number' => '09171234567',
                'password_hash' => Hash::make('StrongPassword123!'),
                'status' => 'approved',
                'reviewed_at' => now(),
            ]);

            $this->postJson('/api/registration-lookup/cell-number', [
                'cell_number' => '+63 917-123-4567',
                'password' => 'StrongPassword123!',
            ])
                ->assertOk()
                ->assertJsonPath('status', 'approved')
                ->assertJsonMissingPath('email')
                ->assertJsonMissingPath('password_hash');

            $this->postJson('/api/registration-lookup/cell-number', [
                'cell_number' => '09171234567',
                'password' => 'wrong-password',
            ])
                ->assertUnprocessable()
                ->assertJsonPath('message', 'The cell number or password is incorrect.');
    }

    public function test_invalid_and_expired_tokens_do_not_reveal_registration_status(): void
    {
        $token = str_repeat('a', 64);
        DB::table('registration_status_verifications')->insert([
            'email' => 'applicant@example.test',
            'token_hash' => hash('sha256', $token),
            'expires_at' => now()->subMinute(),
        ]);

        foreach ([str_repeat('b', 64), $token] as $attemptedToken) {
            $this->postJson('/api/registration-lookup/verify', [
                'email' => 'applicant@example.test',
                'token' => $attemptedToken,
            ])
            ->assertUnprocessable()
            ->assertJsonMissingPath('status');
        }
    }

    public function test_status_verification_requests_are_rate_limited(): void
    {
        Mail::shouldReceive('raw')->times(3)->andReturnNull();

        for ($attempt = 0; $attempt < 3; $attempt++) {
            $this->postJson('/api/registration-lookup', [
                'email' => 'applicant@example.test',
            ])->assertAccepted();
        }

        $this->postJson('/api/registration-lookup', [
            'email' => 'applicant@example.test',
        ])->assertTooManyRequests();
    }

    public function test_status_verification_migration_creates_and_drops_its_table(): void
    {
        Schema::dropIfExists('registration_status_verifications');
        $migration = require database_path(
            'migrations/2026_11_18_000001_create_registration_status_verifications_table.php'
        );

        $migration->up();
        $this->assertTrue(Schema::hasColumns('registration_status_verifications', [
            'id',
            'email',
            'token_hash',
            'expires_at',
            'created_at',
        ]));

        $migration->down();
        $this->assertFalse(Schema::hasTable('registration_status_verifications'));
    }

    private function requestVerificationToken(string $email): string
    {
        $token = null;
        Mail::shouldReceive('raw')
            ->once()
            ->withArgs(function ($body, $callback) use (&$token) {
                preg_match('/token=([a-f0-9]{64})/', $body, $matches);
                $token = $matches[1] ?? null;

                return is_callable($callback);
            })
            ->andReturnNull();

        $this->postJson('/api/registration-lookup', ['email' => $email])
            ->assertAccepted();

        $this->assertNotNull($token);

        return $token;
    }
}
