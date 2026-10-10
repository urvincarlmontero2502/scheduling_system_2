<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\ResourceController;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\DB;

// Public Health Check Endpoint
Route::get('/health', function () {
    $dbConnected = true;

    try {
        DB::connection()->getPdo();
    } catch (\Exception $e) {
        $dbConnected = false;
    }

    return response()->json([
        'api' => true,
        'database' => $dbConnected
    ]);
});

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/verify-email-change', [AuthController::class, 'verifyEmailChange']);

Route::middleware('auth:sanctum')->group(function () {

    // Authentication
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user', [AuthController::class, 'update']);
    Route::put('/user/email', [AuthController::class, 'updateEmail']);
    Route::put('/user/password', [AuthController::class, 'updatePassword']);

    // Dashboard
    Route::get('/dashboard/stats', [BookingController::class, 'stats']);

    // Resources
    Route::get('/resources', [ResourceController::class, 'index']);

    Route::post('/resources', [ResourceController::class, 'store'])
        ->middleware('admin');

    Route::put('/resources/{resource}', [ResourceController::class, 'update'])
        ->middleware('admin');

    Route::delete('/resources/{resource}', [ResourceController::class, 'destroy'])
        ->middleware('admin');

    // Maintenance toggle
    Route::patch('/resources/{resource}/maintenance/on', [ResourceController::class, 'setMaintenance'])
        ->middleware('admin');
    Route::patch('/resources/{resource}/maintenance/off', [ResourceController::class, 'setAvailable'])
        ->middleware('admin');

    // Bookings
    Route::get('/bookings', [BookingController::class, 'index']);

    Route::post('/bookings', [BookingController::class, 'store']);

    Route::patch('/bookings/{booking}/status', [BookingController::class, 'updateStatus'])
        ->middleware('admin');

    Route::delete('/bookings/{booking}', [BookingController::class, 'destroy'])
        ->middleware('admin');
});
