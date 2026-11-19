<?php

namespace Tests\Feature;

use App\Models\ActivityLog;
use App\Models\User;
use Database\Seeders\BarangayAndAdminSeeder;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UserRoleManagementTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('activity_logs');
        Schema::dropIfExists('barangays');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email');
            $table->string('password_hash');
            $table->string('role');
            $table->timestamp('deleted_at')->nullable();
            $table->string('barangay')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('barangays', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
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

        DB::table('barangays')->insert([
            ['name' => 'Poblacion'],
            ['name' => 'Baleguian'],
            ['name' => 'Santo Nino'],
        ]);
    }

    public function test_super_admin_can_promote_a_user_to_barangay_admin_and_audit_the_change(): void
    {
        $admin = $this->createUser('System Admin', 'admin@example.test', 'admin');
        $staff = $this->createUser('Barangay Staff', 'staff@example.test', 'staff', 'Poblacion');
        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$staff->user_id}/role", [
            'role' => 'barangay_admin',
            'barangay' => 'Poblacion',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'barangay_admin')
            ->assertJsonPath('user.barangay', 'Poblacion');

        $this->assertDatabaseHas('activity_logs', [
            'action' => 'user.role_promoted',
            'subject_id' => (string) $staff->user_id,
        ]);
        $this->assertSame('barangay_admin', $staff->fresh()->role);
    }

    public function test_rerunning_account_seeder_does_not_revert_a_promoted_barangay_admin(): void
    {
        $admin = $this->createUser('System Admin', 'admin@example.test', 'admin');
        $staff = $this->createUser(
            'Santo Nino Representative',
            'santonino@system.local',
            'user',
            'Santo Nino',
        );
        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$staff->user_id}/role", [
            'role' => 'barangay_admin',
            'barangay' => 'Santo Nino',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'barangay_admin');

        (new BarangayAndAdminSeeder())->run();

        $this->assertDatabaseHas('users', [
            'user_id' => $staff->user_id,
            'role' => 'barangay_admin',
            'barangay' => 'Santo Nino',
        ]);
    }

    public function test_barangay_admin_can_only_promote_regular_users_in_their_barangay(): void
    {
        $admin = $this->createUser('Poblacion Admin', 'poblacion.admin@example.test', 'barangay_admin', 'Poblacion');
        $localUser = $this->createUser('Local Staff', 'local@example.test', 'staff', 'Poblacion');
        $otherUser = $this->createUser('Other Staff', 'other@example.test', 'staff', 'Baleguian');
        Sanctum::actingAs($admin);

        $this->getJson('/api/users')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonMissing(['email' => 'other@example.test']);

        $this->putJson("/api/users/{$localUser->user_id}/role", [
            'role' => 'barangay_admin',
        ])
            ->assertOk()
            ->assertJsonPath('user.barangay', 'Poblacion');

        $this->putJson("/api/users/{$otherUser->user_id}/role", [
            'role' => 'barangay_admin',
        ])->assertForbidden();

        $anotherLocalUser = $this->createUser('Another Local', 'another@example.test', 'user', 'Poblacion');
        $this->putJson("/api/users/{$anotherLocalUser->user_id}/role", [
            'role' => 'admin',
        ])->assertUnprocessable();
    }

    public function test_super_admin_can_promote_a_barangay_admin_to_super_admin(): void
    {
        $admin = $this->createUser('System Admin', 'admin@example.test', 'admin');
        $barangayAdmin = $this->createUser('Barangay Admin', 'barangay.admin@example.test', 'barangay_admin', 'Poblacion');
        Sanctum::actingAs($admin);

        $this->putJson("/api/users/{$barangayAdmin->user_id}/role", [
            'role' => 'admin',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'admin')
            ->assertJsonPath('user.barangay', null);

        $this->assertSame('admin', $barangayAdmin->fresh()->role);
        $this->assertNull($barangayAdmin->fresh()->barangay);
    }

    public function test_regular_users_cannot_list_or_promote_accounts(): void
    {
        $user = $this->createUser('Regular User', 'user@example.test', 'user');
        $target = $this->createUser('Target User', 'target@example.test', 'staff', 'Poblacion');
        Sanctum::actingAs($user);

        $this->getJson('/api/users')->assertForbidden();
        $this->putJson("/api/users/{$target->user_id}/role", [
            'role' => 'barangay_admin',
            'barangay' => 'Poblacion',
        ])->assertForbidden();
        $this->deleteJson("/api/users/{$target->user_id}")->assertForbidden();
    }

    public function test_super_admin_can_move_users_to_trash_and_restore_them(): void
    {
        $admin = $this->createUser('System Admin', 'admin@example.test', 'admin');
        $staff = $this->createUser('Barangay Staff', 'staff@example.test', 'staff', 'Poblacion');
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/users/{$staff->user_id}")
            ->assertOk()
            ->assertJsonPath('message', 'User moved to the Trash Bin.');

        $this->assertSoftDeleted('users', ['user_id' => $staff->user_id]);
        $this->getJson('/api/users/trashed')
            ->assertOk()
            ->assertJsonFragment(['email' => 'staff@example.test']);
        $this->getJson('/api/users')
            ->assertOk()
            ->assertJsonMissing(['email' => 'staff@example.test']);

        $this->postJson("/api/users/{$staff->user_id}/restore")
            ->assertOk()
            ->assertJsonPath('user.email', 'staff@example.test');

        $this->assertDatabaseHas('users', [
            'user_id' => $staff->user_id,
            'deleted_at' => null,
        ]);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'user.trashed',
            'subject_id' => (string) $staff->user_id,
        ]);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'user.restored',
            'subject_id' => (string) $staff->user_id,
        ]);
    }

    public function test_super_admin_cannot_trash_themselves_or_another_super_admin(): void
    {
        $admin = $this->createUser('System Admin', 'admin@example.test', 'admin');
        $anotherAdmin = $this->createUser('Another Admin', 'another-admin@example.test', 'admin');
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/users/{$admin->user_id}")->assertUnprocessable();
        $this->deleteJson("/api/users/{$anotherAdmin->user_id}")->assertUnprocessable();

        $this->assertDatabaseHas('users', ['user_id' => $admin->user_id, 'deleted_at' => null]);
        $this->assertDatabaseHas('users', ['user_id' => $anotherAdmin->user_id, 'deleted_at' => null]);
    }

    public function test_super_admin_can_permanently_delete_a_trashed_user(): void
    {
        $admin = $this->createUser('System Admin', 'admin@example.test', 'admin');
        $staff = $this->createUser('Barangay Staff', 'staff@example.test', 'staff');
        Sanctum::actingAs($admin);

        $this->deleteJson("/api/users/{$staff->user_id}/force")->assertConflict();
        $this->deleteJson("/api/users/{$staff->user_id}")->assertOk();
        $this->deleteJson("/api/users/{$staff->user_id}/force")
            ->assertOk()
            ->assertJsonPath('message', 'User and their booking history were permanently deleted.');

        $this->assertDatabaseMissing('users', ['user_id' => $staff->user_id]);
        $this->assertDatabaseHas('activity_logs', [
            'action' => 'user.permanently_deleted',
            'subject_id' => (string) $staff->user_id,
        ]);
    }

    private function createUser(string $name, string $email, string $role, ?string $barangay = null): User
    {
        return User::create([
            'full_name' => $name,
            'email' => $email,
            'password_hash' => 'not-a-real-password',
            'role' => $role,
            'barangay' => $barangay,
            'created_at' => now(),
        ]);
    }
}
