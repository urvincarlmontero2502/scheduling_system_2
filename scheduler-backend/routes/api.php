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

Route::post('/login', [AuthController::class, 'login']);

Route::middleware('auth:sanctum')->group(function () {

    // Authentication
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

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

    // Bookings
    Route::get('/bookings', [BookingController::class, 'index']);

    Route::post('/bookings', [BookingController::class, 'store']);

    Route::patch('/bookings/{booking}/status', [BookingController::class, 'updateStatus'])
        ->middleware('admin');

    Route::delete('/bookings/{booking}', [BookingController::class, 'destroy'])
        ->middleware('admin');
});
