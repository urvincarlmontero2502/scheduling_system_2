<?php

namespace Tests\Feature;

use App\Mail\BookingReminder;
use App\Models\BookingRequest;
use App\Models\Resource;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class BookingReminderTest extends TestCase
{
    private User $admin;

    private User $requester;

    private Resource $resource;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('booking_request');
        Schema::dropIfExists('system_settings');
        Schema::dropIfExists('resources');
        Schema::dropIfExists('users');

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
            $table->unsignedInteger('buffer_minutes')->default(30);
        });
        Schema::create('booking_request', function (Blueprint $table) {
            $table->id('booking_id');
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('resource_id');
            $table->string('reference_id')->nullable();
            $table->string('full_name')->nullable();
            $table->string('purpose')->nullable();
            $table->date('start_date');
            $table->date('end_date');
            $table->string('start_time')->nullable();
            $table->string('end_time')->nullable();
            $table->string('email')->nullable();
            $table->string('status');
            $table->timestamp('reminder_sent_at')->nullable();
        });
        Schema::create('system_settings', function (Blueprint $table) {
            $table->string('key')->primary();
            $table->string('value');
            $table->timestamps();
        });

        $this->admin = User::create([
            'full_name' => 'System Admin',
            'email' => 'admin@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'admin',
        ]);
        $this->requester = User::create([
            'full_name' => 'Booking Requester',
            'email' => 'requester@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'staff',
        ]);
        $this->resource = Resource::create([
            'name' => 'Community Hall',
        ]);
    }

    protected function tearDown(): void
    {
        Carbon::setTestNow();

        parent::tearDown();
    }

    public function test_admin_can_read_and_update_the_system_wide_reminder_lead_time(): void
    {
        Sanctum::actingAs($this->admin);

        $this->getJson('/api/admin/settings/booking-reminder')
            ->assertOk()
            ->assertJsonPath('days_before', 1);

        $this->putJson('/api/admin/settings/booking-reminder', ['days_before' => 3])
            ->assertOk()
            ->assertJsonPath('days_before', 3);

        $this->getJson('/api/admin/settings/booking-reminder')
            ->assertOk()
            ->assertJsonPath('days_before', 3);
    }

    public function test_each_supported_reminder_interval_is_accepted(): void
    {
        Sanctum::actingAs($this->admin);

        foreach ([1, 3, 5] as $daysBefore) {
            $this->putJson('/api/admin/settings/booking-reminder', [
                'days_before' => $daysBefore,
            ])->assertOk()->assertJsonPath('days_before', $daysBefore);
        }

        $this->putJson('/api/admin/settings/booking-reminder', ['days_before' => 2])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('days_before');
    }

    public function test_only_system_admin_can_change_global_reminder_settings(): void
    {
        $barangayAdmin = User::create([
            'full_name' => 'Barangay Admin',
            'email' => 'barangay-admin@example.test',
            'password_hash' => 'not-a-real-password',
            'role' => 'barangay_admin',
        ]);
        Sanctum::actingAs($barangayAdmin);

        $this->getJson('/api/admin/settings/booking-reminder')->assertForbidden();
    }

    public function test_command_sends_one_reminder_for_each_due_approved_booking(): void
    {
        Carbon::setTestNow(Carbon::parse('2026-11-12 09:00:00', 'Asia/Manila'));
        DB::table('system_settings')->insert([
            'key' => 'booking_reminder_days_before',
            'value' => '1',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $dueBooking = $this->createBooking('approved', '2026-11-13');
        $this->createBooking('pending', '2026-11-13');
        $this->createBooking('approved', '2026-11-18');

        Mail::fake();

        $this->artisan('bookings:send-reminders')->assertSuccessful();

        Mail::assertSent(BookingReminder::class, function (BookingReminder $mail) use ($dueBooking) {
            return $mail->booking->booking_id === $dueBooking->booking_id
                && $mail->hasTo('requester@example.test');
        });
        Mail::assertSent(BookingReminder::class, 1);
        $this->assertNotNull($dueBooking->fresh()->reminder_sent_at);

        DB::table('system_settings')
            ->where('key', 'booking_reminder_days_before')
            ->update(['value' => '3']);
        $threeDayBooking = $this->createBooking('approved', '2026-11-15');

        $this->artisan('bookings:send-reminders')->assertSuccessful();
        Mail::assertSent(BookingReminder::class, function (BookingReminder $mail) use ($threeDayBooking) {
            return $mail->booking->booking_id === $threeDayBooking->booking_id;
        });
        Mail::assertSent(BookingReminder::class, 2);

        $this->artisan('bookings:send-reminders')->assertSuccessful();
        Mail::assertSent(BookingReminder::class, 2);
    }

    private function createBooking(string $status, string $startDate): BookingRequest
    {
        return BookingRequest::create([
            'user_id' => $this->requester->user_id,
            'resource_id' => $this->resource->resource_id,
            'full_name' => $this->requester->full_name,
            'purpose' => 'Community meeting',
            'start_date' => $startDate,
            'end_date' => $startDate,
            'start_time' => '09:00',
            'end_time' => '10:00',
            'email' => $this->requester->email,
            'status' => $status,
        ]);
    }
}
