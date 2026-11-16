<?php

namespace Tests\Feature;

use App\Models\Resource;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ResourcePricingTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        foreach (['activity_logs', 'facility_details', 'vehicle_details', 'resources', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table) {
            $table->id('user_id');
            $table->string('full_name');
            $table->string('email');
            $table->string('password_hash');
            $table->string('role');
        });
        Schema::create('resources', function (Blueprint $table) {
            $table->id('resource_id');
            $table->string('name');
            $table->string('type');
            $table->string('status');
            $table->string('image')->nullable();
            $table->json('images')->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('buffer_minutes')->default(30);
            $table->decimal('price_per_day', 10, 2)->nullable();
            $table->decimal('price_per_hour', 10, 2)->nullable();
            $table->text('inclusions')->nullable();
            $table->timestamp('deleted_at')->nullable();
        });
        Schema::create('facility_details', function (Blueprint $table) {
            $table->unsignedBigInteger('resource_id')->primary();
            $table->integer('capacity')->nullable();
        });
        Schema::create('vehicle_details', function (Blueprint $table) {
            $table->unsignedBigInteger('resource_id')->primary();
            $table->string('unit_name')->nullable();
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
            'full_name' => 'Resource Admin',
            'email' => 'resource-admin@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'admin',
        ]);
        Sanctum::actingAs($this->admin);
        Storage::fake('assets');
    }

    public function test_resource_price_and_inclusions_are_created_and_returned_by_the_index(): void
    {
        $this->postJson('/api/resources', [
            'name' => 'Lakefront Function Hall',
            'type' => 'facility',
            'buffer_minutes' => 30,
            'capacity' => 100,
            'price_per_day' => '1500.00',
            'inclusions' => "Tables, Chairs\nSound system",
        ])
            ->assertCreated()
            ->assertJsonPath('resource.price_per_day', 1500)
            ->assertJsonPath('resource.inclusions', "Tables, Chairs\nSound system");

        $this->assertDatabaseHas('resources', [
            'name' => 'Lakefront Function Hall',
            'price_per_day' => '1500.00',
            'inclusions' => "Tables, Chairs\nSound system",
        ]);

        $this->getJson('/api/resources')
            ->assertOk()
            ->assertJsonPath('0.price_per_day', 1500)
            ->assertJsonPath('0.inclusions', "Tables, Chairs\nSound system");
    }

    public function test_resource_price_and_inclusions_are_optional(): void
    {
        $this->postJson('/api/resources', [
            'name' => 'Unpriced Meeting Room',
            'type' => 'facility',
            'buffer_minutes' => 30,
            'capacity' => 20,
        ])
            ->assertCreated()
            ->assertJsonPath('resource.price_per_day', null)
            ->assertJsonPath('resource.inclusions', null);
    }

    public function test_vehicle_hourly_price_and_inclusions_are_created_and_returned(): void
    {
        $this->postJson('/api/resources', [
            'name' => 'Utility Van',
            'type' => 'vehicle',
            'buffer_minutes' => 30,
            'unit_name' => 'ABC-1234',
            'price_per_hour' => '250.50',
            'inclusions' => "Driver\nFuel",
        ])
            ->assertCreated()
            ->assertJsonPath('resource.price_per_day', null)
            ->assertJsonPath('resource.price_per_hour', 250.5)
            ->assertJsonPath('resource.inclusions', "Driver\nFuel");

        $this->assertDatabaseHas('resources', [
            'name' => 'Utility Van',
            'price_per_hour' => '250.50',
            'inclusions' => "Driver\nFuel",
        ]);

        $this->getJson('/api/resources?type=vehicle')
            ->assertOk()
            ->assertJsonPath('0.price_per_hour', 250.5)
            ->assertJsonPath('0.inclusions', "Driver\nFuel");
    }

    public function test_vehicle_hourly_price_can_be_updated_or_cleared(): void
    {
        $resource = Resource::create([
            'name' => 'Utility Van',
            'type' => 'vehicle',
            'status' => 'available',
        ]);

        $payload = [
            'name' => 'Utility Van',
            'type' => 'vehicle',
            'buffer_minutes' => 30,
            'unit_name' => 'ABC-1234',
            'price_per_hour' => '300.00',
            'inclusions' => 'Driver and fuel',
        ];

        $this->putJson("/api/resources/{$resource->resource_id}", $payload)
            ->assertOk()
            ->assertJsonPath('resource.price_per_hour', 300)
            ->assertJsonPath('resource.inclusions', 'Driver and fuel');

        $this->putJson("/api/resources/{$resource->resource_id}", [
            ...$payload,
            'price_per_hour' => null,
            'inclusions' => null,
        ])
            ->assertOk()
            ->assertJsonPath('resource.price_per_hour', null)
            ->assertJsonPath('resource.inclusions', null);

        $this->assertDatabaseHas('resources', [
            'resource_id' => $resource->resource_id,
            'price_per_hour' => null,
            'inclusions' => null,
        ]);
    }

    public function test_resource_price_and_inclusions_can_be_updated(): void
    {
        $resource = Resource::create([
            'name' => 'Meeting Room',
            'type' => 'facility',
            'status' => 'available',
        ]);

        $this->putJson("/api/resources/{$resource->resource_id}", [
            'name' => 'Meeting Room',
            'type' => 'facility',
            'buffer_minutes' => 30,
            'capacity' => '40',
            'price_per_day' => '875.50',
            'inclusions' => "Projector\nWhiteboard",
        ])
            ->assertOk()
            ->assertJsonPath('resource.price_per_day', 875.5)
            ->assertJsonPath('resource.inclusions', "Projector\nWhiteboard");

        $this->assertDatabaseHas('resources', [
            'resource_id' => $resource->resource_id,
            'price_per_day' => '875.50',
            'inclusions' => "Projector\nWhiteboard",
        ]);

        $this->putJson("/api/resources/{$resource->resource_id}", [
            'name' => 'Meeting Room',
            'type' => 'facility',
            'buffer_minutes' => 30,
            'capacity' => '40',
            'price_per_day' => null,
            'inclusions' => null,
        ])
            ->assertOk()
            ->assertJsonPath('resource.price_per_day', null)
            ->assertJsonPath('resource.inclusions', null);

        $this->assertDatabaseHas('resources', [
            'resource_id' => $resource->resource_id,
            'price_per_day' => null,
            'inclusions' => null,
        ]);
    }

    public function test_omitting_optional_fields_from_an_update_preserves_existing_values(): void
    {
        $resource = Resource::create([
            'name' => 'Meeting Room',
            'type' => 'facility',
            'status' => 'available',
            'price_per_day' => '875.50',
            'inclusions' => 'Projector',
        ]);

        $this->putJson("/api/resources/{$resource->resource_id}", [
            'name' => 'Updated Meeting Room',
            'type' => 'facility',
            'buffer_minutes' => 30,
            'capacity' => '40',
        ])->assertOk();

        $this->assertDatabaseHas('resources', [
            'resource_id' => $resource->resource_id,
            'price_per_day' => '875.50',
            'inclusions' => 'Projector',
        ]);
    }

    public function test_resource_price_must_be_nonnegative_and_have_at_most_two_decimal_places(): void
    {
        $payload = [
            'name' => 'Invalid Price Resource',
            'type' => 'facility',
            'buffer_minutes' => 30,
            'capacity' => 20,
        ];

        foreach (['-1.00', '1.001'] as $invalidPrice) {
            $this->postJson('/api/resources', [
                ...$payload,
                'price_per_day' => $invalidPrice,
            ])
                ->assertUnprocessable()
                ->assertJsonValidationErrors('price_per_day');
        }
    }
}
