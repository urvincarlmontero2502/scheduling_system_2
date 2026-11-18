<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LegacySpaTokenRevocationTest extends TestCase
{
    public function test_user_soft_delete_migration_adds_and_drops_deleted_at(): void
    {
        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('email');
        });

        $migration = require database_path(
            'migrations/2026_11_18_000004_add_soft_deletes_to_users_table.php'
        );
        $migration->up();
        $this->assertTrue(Schema::hasColumn('users', 'deleted_at'));

        $migration->down();
        $this->assertFalse(Schema::hasColumn('users', 'deleted_at'));
    }

    public function test_remember_token_migration_adds_and_drops_the_user_column(): void
    {
        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('email');
        });

        $migration = require database_path(
            'migrations/2026_11_18_000002_add_remember_token_to_users_table.php'
        );
        $migration->up();
        $this->assertTrue(Schema::hasColumn('users', 'remember_token'));

        $migration->down();
        $this->assertFalse(Schema::hasColumn('users', 'remember_token'));
    }

    public function test_migration_revokes_legacy_spa_tokens_only(): void
    {
        Schema::dropIfExists('personal_access_tokens');
        Schema::create('personal_access_tokens', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('token');
        });
        DB::table('personal_access_tokens')->insert([
            ['name' => 'spa-token', 'token' => 'legacy-token-hash'],
            ['name' => 'external-integration', 'token' => 'other-token-hash'],
        ]);

        $migration = require database_path(
            'migrations/2026_11_18_000003_revoke_legacy_spa_tokens.php'
        );
        $migration->up();

        $this->assertDatabaseMissing('personal_access_tokens', [
            'name' => 'spa-token',
        ]);
        $this->assertDatabaseHas('personal_access_tokens', [
            'name' => 'external-integration',
            'token' => 'other-token-hash',
        ]);
    }
}
