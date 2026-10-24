<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BookingController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\RegistrationController;
use App\Http\Controllers\ResourceController;
use App\Http\Controllers\UploadController;
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

    // Check if required columns exist for Google OAuth
    $columns = [];
    $missing = [];
    try {
        $columns = DB::connection()
            ->select("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        $columnNames = array_map(fn($c) => $c->column_name, $columns);
        
        foreach (['google_id', 'email_verified_at', 'full_name', 'email', 'password_hash', 'role'] as $col) {
            if (!in_array($col, $columnNames)) {
                $missing[] = $col;
            }
        }
    } catch (\Exception $e) {
        $missing = ['error_checking: ' . $e->getMessage()];
    }

    // Check personal_access_tokens table
    $tokensTableExists = true;
    try {
        DB::connection()->select("SELECT 1 FROM personal_access_tokens LIMIT 1");
    } catch (\Exception $e) {
        $tokensTableExists = false;
    }

    return response()->json([
        'api' => true,
        'database' => $dbConnected,
        'missing_columns' => $missing,
        'personal_access_tokens_table' => $tokensTableExists,
        'user_columns' => array_map(fn($c) => $c->column_name, $columns),
    ]);
});

Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('/verify-email-change', [AuthController::class, 'verifyEmailChange']);
Route::get('/auth/google', [AuthController::class, 'redirectToGoogle']);
Route::post('/auth/google/callback', [AuthController::class, 'handleGoogleCallback'])
    ->middleware('throttle:10,1'); // 10 attempts per minute
Route::post('/auth/google/complete-registration', [AuthController::class, 'completeGoogleRegistration']);

// Diagnostic endpoint to check database schema
Route::get('/diagnostics/oauth-schema', function () {
    $missing = [];
    $columns = [];
    $tablesOk = true;
    
    try {
        $columns = DB::connection()
            ->select("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
        $columnNames = array_map(fn($c) => $c->column_name, $columns);
        
        foreach (['google_id', 'email_verified_at', 'full_name', 'email', 'password_hash', 'role'] as $col) {
            if (!in_array($col, $columnNames)) {
                $missing[] = $col;
            }
        }
    } catch (\Exception $e) {
        $missing = ['error: ' . $e->getMessage()];
    }

    try {
        DB::connection()->select("SELECT 1 FROM personal_access_tokens LIMIT 1");
    } catch (\Exception $e) {
        $tablesOk = false;
        $missing[] = 'personal_access_tokens table missing';
    }

    return response()->json([
        'users_columns' => array_map(fn($c) => $c->column_name, $columns),
        'missing_columns' => $missing,
        'tokens_table_exists' => $tablesOk,
        'all_required_present' => empty($missing),
    ]);
});

// Diagnostic: check resources table schema
Route::get('/diagnostics/resources-schema', function () {
    $result = ['resources_table_exists' => true, 'columns' => [], 'missing_columns' => []];
    
    try {
        $cols = DB::connection()
            ->select("SELECT column_name FROM information_schema.columns WHERE table_name = 'resources'");
        $result['columns'] = array_map(fn($c) => $c->column_name, $cols);
        
        foreach (['resource_id', 'name', 'type', 'status', 'image', 'description'] as $col) {
            if (!in_array($col, $result['columns'])) {
                $result['missing_columns'][] = $col;
            }
        }
    } catch (Exception $e) {
        $result['resources_table_exists'] = false;
        $result['error'] = $e->getMessage();
    }
    
    // Also check detail tables
    try {
        $tables = DB::connection()
            ->select("SELECT table_name FROM information_schema.tables WHERE table_name IN ('facility_details', 'vehicle_details')");
        $result['detail_tables'] = array_map(fn($t) => $t->table_name, $tables);
    } catch (Exception $e) {
        $result['detail_tables_error'] = $e->getMessage();
    }
    
    return response()->json($result);
});

// Diagnostic: check oauth temp tokens table accessibility
Route::get('/diagnostics/oauth-tokens', function () {
    $result = [
        'table_exists' => true,
        'accessible' => true,
        'token_count' => 0,
        'error' => null,
    ];

    try {
        $tableExists = DB::connection()
            ->select("SELECT 1 FROM information_schema.tables WHERE table_name = 'google_oauth_temp_tokens' LIMIT 1");

        $result['table_exists'] = !empty($tableExists);

        if ($result['table_exists']) {
            $count = DB::connection()
                ->select("SELECT COUNT(*) as cnt FROM google_oauth_temp_tokens");
            $result['token_count'] = (int) $count[0]->cnt;
        }
    } catch (\Exception $e) {
        $result['accessible'] = false;
        $result['error'] = $e->getMessage();
    }

    return response()->json($result);
});

// Public: get barangays list (no auth required — needed during registration flow)
Route::get('/barangays', [AuthController::class, 'getBarangays']);

Route::middleware('auth:sanctum')->group(function () {

    // Authentication
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::put('/user', [AuthController::class, 'update']);
    Route::put('/user/email', [AuthController::class, 'updateEmail']);
    Route::put('/user/password', [AuthController::class, 'updatePassword']);
    Route::post('/user/profile-image', [AuthController::class, 'updateProfileImage']);

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

    // Availability suggestions endpoint
    Route::get('/bookings/availability', [BookingController::class, 'availability']);

    Route::patch('/bookings/{booking}/status', [BookingController::class, 'updateStatus'])
        ->middleware('admin');

    Route::delete('/bookings/{id}', [BookingController::class, 'destroy'])
        ->middleware('admin');

    // Asset / Media Uploads
    Route::post('/uploads', [UploadController::class, 'upload'])
        ->middleware('admin');
    Route::delete('/uploads', [UploadController::class, 'delete'])
        ->middleware('admin');

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::patch('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/mark-all-read', [NotificationController::class, 'markAllAsRead']);
    Route::delete('/notifications/{notification}', [NotificationController::class, 'destroy']);
    Route::get('/uploads/{path}', [UploadController::class, 'getFile'])
        ->where('path', '.*');

    // Barangay management
    Route::post('/barangays', [AuthController::class, 'createBarangay'])
        ->middleware('admin');

    // Registration Requests (user approval workflow)
    // Barangay admins can access their own barangay's requests; super-admins see all
    Route::get('/registration-requests', [RegistrationController::class, 'index'])
        ->middleware('admin');
    Route::get('/registration-requests/processed', [RegistrationController::class, 'processed'])
        ->middleware('admin');
    Route::get('/registration-requests/{requestId}', [RegistrationController::class, 'show'])
        ->middleware('admin');
    Route::post('/registration-requests/{requestId}/approve', [RegistrationController::class, 'approve'])
        ->middleware('admin');
    Route::post('/registration-requests/{requestId}/reject', [RegistrationController::class, 'reject'])
        ->middleware('admin');

    // Admin: list all users
    Route::get('/users', [\App\Http\Controllers\AuthController::class, 'listUsers'])
        ->middleware('admin');
});
