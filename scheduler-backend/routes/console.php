<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('bookings:send-reminders')
    ->dailyAt('09:00')
    ->timezone('Asia/Manila')
    ->withoutOverlapping();

Schedule::command('events:seed-annual')
    ->yearlyOn(1, 1, '00:30')
    ->timezone('Asia/Manila')
    ->withoutOverlapping();

Schedule::command('activity-logs:purge-expired')
    ->dailyAt('00:45')
    ->timezone('Asia/Manila')
    ->withoutOverlapping();
