<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AccountSettingsTest extends TestCase
{
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email')->unique();
            $table->string('password_hash');
            $table->string('role')->default('staff');
            $table->string('barangay')->nullable();
            $table->string('department')->nullable();
        });

        $userId = DB::table('users')->insertGetId([
            'full_name' => 'Original Name',
            'email' => 'account@example.test',
            'password_hash' => Hash::make('old-password'),
            'role' => 'barangay_admin',
            'barangay' => 'Poblacion',
            'department' => 'Operations',
        ], 'user_id');
        $this->user = User::findOrFail($userId);
        Sanctum::actingAs($this->user);
    }

    public function test_profile_can_be_updated_without_changing_role_or_email(): void
    {
        $this->putJson('/api/user', [
            'full_name' => 'Updated Name',
            'barangay' => 'Bunga',
            'department' => 'Administration',
        ])->assertOk()
            ->assertJsonPath('full_name', 'Updated Name')
            ->assertJsonPath('email', 'account@example.test')
            ->assertJsonPath('role', 'barangay_admin');

        $this->assertDatabaseHas('users', [
            'user_id' => $this->user->user_id,
            'full_name' => 'Updated Name',
            'email' => 'account@example.test',
            'role' => 'barangay_admin',
            'barangay' => 'Bunga',
            'department' => 'Administration',
        ]);
    }

    public function test_profile_update_rejects_role_and_email_changes(): void
    {
        $this->putJson('/api/user', [
            'full_name' => 'Updated Name',
            'email' => 'attacker@example.test',
            'role' => 'admin',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'role']);

        $this->assertDatabaseHas('users', [
            'user_id' => $this->user->user_id,
            'email' => 'account@example.test',
            'role' => 'barangay_admin',
            'full_name' => 'Original Name',
        ]);
    }

    public function test_password_can_be_changed_with_the_current_password(): void
    {
        $this->putJson('/api/user/password', [
            'current_password' => 'old-password',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertOk()
            ->assertJsonPath('message', 'Password updated successfully.');

        $this->assertTrue(Hash::check(
            'new-password-123',
            $this->user->fresh()->password_hash
        ));
    }

    public function test_password_change_rejects_an_incorrect_current_password(): void
    {
        $this->putJson('/api/user/password', [
            'current_password' => 'wrong-password',
            'password' => 'new-password-123',
            'password_confirmation' => 'new-password-123',
        ])->assertUnprocessable()
            ->assertJsonPath('message', 'The provided password is incorrect.');

        $this->assertTrue(Hash::check(
            'old-password',
            $this->user->fresh()->password_hash
        ));
    }
}
