<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CellNumberAccountMigrationTest extends TestCase
{
    public function test_migration_adds_optional_unique_cell_numbers_and_allows_missing_emails(): void
    {
        Schema::dropIfExists('registration_requests');
        Schema::dropIfExists('users');

        foreach (['users', 'registration_requests'] as $tableName) {
            Schema::create($tableName, function (Blueprint $table) {
                $table->id();
                $table->string('email')->unique();
            });
        }

        $migration = require database_path(
            'migrations/2026_11_24_000001_allow_cell_number_staff_accounts.php'
        );
        $migration->up();

        foreach (['users', 'registration_requests'] as $tableName) {
            $columns = collect(Schema::getColumns($tableName))->keyBy('name');

            $this->assertTrue($columns->has('cell_number'));
            $this->assertTrue($columns->get('email')['nullable']);
            $this->assertTrue($columns->get('cell_number')['nullable']);
        }

        $migration->down();

        foreach (['users', 'registration_requests'] as $tableName) {
            $columns = collect(Schema::getColumns($tableName))->keyBy('name');

            $this->assertFalse($columns->has('cell_number'));
            $this->assertFalse($columns->get('email')['nullable']);
        }
    }
}
