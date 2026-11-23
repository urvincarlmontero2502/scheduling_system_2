<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PasswordResetTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('password_resets');
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
        Schema::create('password_resets', function (Blueprint $table) {
            $table->id();
            $table->string('email')->index();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });
    }

    public function test_password_reset_schema_migration_creates_the_expected_table(): void
    {
        Schema::dropIfExists('password_resets');

        $migration = require database_path(
            'migrations/2026_11_23_000002_ensure_password_resets_table.php'
        );
        $migration->up();

        $this->assertTrue(Schema::hasColumns('password_resets', [
            'id',
            'email',
            'token',
            'created_at',
        ]));
    }

    public function test_reset_code_can_set_a_password_for_a_case_insensitive_email(): void
    {
        $user = User::create([
            'full_name' => 'Google Account',
            'email' => 'Account.Owner@example.test',
            'password_hash' => Hash::make('old-password'),
            'password_setup_required' => true,
            'role' => 'staff',
        ]);
        DB::table('password_resets')->insert([
            'email' => $user->email,
            'token' => Hash::make('123456'),
            'created_at' => now(),
        ]);

        $this->postJson('/api/reset-password', [
            'email' => 'account.owner@example.test',
            'code' => '123456',
            'password' => 'RecoveredPassword123!',
            'password_confirmation' => 'RecoveredPassword123!',
        ])
            ->assertOk()
            ->assertJsonPath('message', 'Password reset successfully. You can now sign in.');

        $this->assertTrue(Hash::check(
            'RecoveredPassword123!',
            $user->fresh()->password_hash
        ));
        $this->assertFalse($user->fresh()->password_setup_required);
        $this->assertDatabaseMissing('password_resets', ['email' => $user->email]);

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
            'email' => 'account.owner@example.test',
            'password' => 'RecoveredPassword123!',
            'recaptcha_token' => 'valid-recaptcha-token',
        ])->assertOk()
            ->assertJsonPath('user.email', $user->email);
    }

    public function test_expired_or_invalid_reset_codes_are_rejected_without_changing_password(): void
    {
        $user = User::create([
            'full_name' => 'Google Account',
            'email' => 'account.owner@example.test',
            'password_hash' => Hash::make('old-password'),
            'password_setup_required' => false,
            'role' => 'staff',
        ]);
        DB::table('password_resets')->insert([
            'email' => $user->email,
            'token' => Hash::make('123456'),
            'created_at' => now()->subMinutes(16),
        ]);

        $this->postJson('/api/reset-password', [
            'email' => $user->email,
            'code' => '123456',
            'password' => 'RecoveredPassword123!',
            'password_confirmation' => 'RecoveredPassword123!',
        ])
            ->assertUnprocessable()
            ->assertJsonPath('message', 'The password reset code is invalid or expired.');

        $this->assertTrue(Hash::check('old-password', $user->fresh()->password_hash));
    }
}
