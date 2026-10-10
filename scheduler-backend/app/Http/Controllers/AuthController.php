<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Barangay;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
            'remember_me' => ['nullable', 'boolean'],
        ]);

        $rememberMe = $credentials['remember_me'] ?? false;
        unset($credentials['remember_me']);

        if (!Auth::attempt($credentials)) {
            throw ValidationException::withMessages([
                'email' => ['These credentials do not match our records.'],
            ]);
        }

        $user = User::where('email', $credentials['email'])->firstOrFail();

        // Adjust token expiration based on remember_me
        $expiresAt = $rememberMe
            ? now()->addDays(30)   // 30 days when "Remember me" is checked
            : now()->addHours(12); // 12 hours otherwise

        $token = $user->createToken('spa-token', ['*'], $expiresAt)->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $user,
            'expires_at' => $expiresAt->toDateTimeString(),
        ]);
    }

    public function forgotPassword(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email'],
        ]);

        $user = User::where('email', $validated['email'])->first();

        if (!$user) {
            // Don't reveal whether the email exists
            return response()->json([
                'message' => 'If an account with that email exists, a password reset link has been sent.',
            ]);
        }

        // Generate a 6-digit verification code (valid for 15 minutes)
        $code = str_pad(random_int(0, 999999), 6, '0', STR_PAD_LEFT);

        // Store in password_resets table (Laravel's built-in broker uses this)
        DB::table('password_resets')->updateOrInsert(
            ['email' => $validated['email']],
            [
                'email' => $validated['email'],
                'token' => $code,
                'created_at' => now(),
            ]
        );

        // Send the code via email (if mail is configured)
        try {
            Mail::raw(
                "You recently requested a password reset for your Scheduler account.

" .
                "Your verification code is: " . $code . "

" .
                "This code will expire in 15 minutes.

" .
                "If you did not request this, you can safely ignore this email.",
                function ($message) use ($validated) {
                    $message->to($validated['email'])
                        ->subject('Your Password Reset Code');
                }
            );
        } catch (\Exception $e) {
            \Log::error('Failed to send password reset email: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'If an account with that email exists, a password reset link has been sent.',
            'reset_code' => $code, // For dev/testing; remove in production
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out.']);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    public function update(Request $request)
    {
        $user = $request->user();

        // Temporary delete account endpoint via POST /user
        if ($request->input('delete_account') === true) {
            return $this->destroyUser($request);
        }

        $validated = $request->validate([
            'full_name' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255', 'unique:users,email,' . $user->user_id . ',user_id'],
            'barangay' => ['nullable', 'string', 'max:255'],
            'department' => ['nullable', 'string', 'max:255'],
        ]);

        $user->update(array_filter($validated));

        return response()->json($user);
    }

    /**
     * Delete the authenticated user's account (temporary).
     * Deletes the user and all associated tokens.
     */
    public function destroyUser(Request $request)
    {
        $user = $request->user();

        try {
            // Delete all of the user's tokens first (so they can't make more requests)
            $user->tokens()->delete();

            // Soft-delete the user (mark as deleted without actually removing the record)
            // This prevents JIT re-registration with the same email
            $user->deleted_at = now();
            $user->save();

            // Clear the session if using session driver
            Auth::logout();

            return response()->json([
                'message' => 'Account deleted successfully.',
            ]);
        } catch (\Exception $e) {
            \Log::error('Account deletion error: ' . $e->getMessage(), [
                'user_id' => $user->user_id,
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'message' => 'Failed to delete account. Please try again.',
                'error_detail' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Upload or update the user's profile picture.
     */
    public function updateProfileImage(Request $request)
    {
        $user = $request->user();

        $request->validate([
            'image' => ['required', 'file', 'image', 'mimes:jpeg,png,jpg,gif,webp', 'max:5120'],
        ]);

        // Delete old profile image if it exists
        if ($user->profile_image) {
            $oldPath = str_replace('/storage/uploads/', '', $user->profile_image);
            Storage::disk('assets')->delete($oldPath);
        }

        // Generate unique filename
        $filename = Str::uuid() . '.' . $request->file('image')->getClientOriginalExtension();
        $path = $request->file('image')->storeAs('profiles', $filename, 'assets');

        $url = Storage::disk('assets')->url($path);

        $user->profile_image = $url;
        $user->save();

        return response()->json([
            'message' => 'Profile image updated successfully.',
            'profile_image' => $url,
        ]);
    }

    /**
     * Initiate an email change with verification token workflow.
     * The new email is NOT applied to the user record until verified.
     */
    public function updateEmail(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'email' => ['required', 'email', 'max:255', 'confirmed', 'unique:users,email,' . $user->user_id . ',user_id'],
            'email_confirmation' => ['required', 'email'],
        ]);

        // 1. Strict password verification against stored hash
        if (!Hash::check($validated['current_password'], $user->password_hash)) {
            return response()->json([
                'message' => 'The provided password is incorrect.',
            ], 422);
        }

        // 2. Database uniqueness check (also handled by 'unique' rule above)
        $existing = User::where('email', $validated['email'])
            ->where('user_id', '!=', $user->user_id)
            ->first();
        if ($existing) {
            return response()->json([
                'message' => 'This email address is already in use by another account.',
            ], 422);
        }

        // 3. Generate secure verification token (24-hour expiry)
        $token = Str::random(64);
        $user->pending_email = $validated['email'];
        $user->email_verification_token = $token;
        $user->email_verification_sent_at = now();
        $user->save();

        // 4. Audit log
        DB::table('email_change_logs')->insert([
            'user_id' => $user->user_id,
            'old_email' => $user->getOriginal('email'),
            'new_email' => $validated['email'],
            'status' => 'pending',
            'ip_address' => $request->ip(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // 5. Send verification email
        try {
            $frontendUrl = config('app.frontend_url', env('FRONTEND_URL', 'http://scheduler-frontend.test'));
            $verificationUrl = $frontendUrl . '/verify-email-change?token=' . $token;

            Mail::raw(
                "You recently requested to change the email address on your Scheduler account.

" .
                "Your new email address: " . $validated['email'] . "

" .
                "To confirm and complete this change, please click the link below (valid for 24 hours):
" .
                $verificationUrl . "

" .
                "If you did not request this change, you can safely ignore this email.
",
                function ($message) use ($validated) {
                    $message->to($validated['email'])
                        ->subject('Verify Your Email Change');
                }
            );
        } catch (\Exception $e) {
            \Log::error('Failed to send email verification: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'A verification email has been sent to your new address. Please check your inbox and click the confirmation link to complete the change.',
            'status' => 'pending',
            'verification_required' => true,
        ], 202);
    }

    /**
     * Verify the email change token and apply the pending email.
     */
    public function verifyEmailChange(Request $request)
    {
        $validated = $request->validate([
            'token' => ['required', 'string', 'max:64'],
        ]);

        $user = User::where('email_verification_token', $validated['token'])
            ->where('email_verification_sent_at', '>=', \Carbon\Carbon::now()->subDay())
            ->first();

        if (!$user) {
            return response()->json([
                'message' => 'The verification link is invalid or has expired. Please request a new email change.',
            ], 404);
        }

        // Apply the pending email
        $user->email = $user->pending_email;
        $user->pending_email = null;
        $user->email_verification_token = null;
        $user->email_verification_sent_at = null;
        $user->save();

        // Update audit log to completed
        DB::table('email_change_logs')
            ->where('user_id', $user->user_id)
            ->where('status', 'pending')
            ->update([
                'status' => 'completed',
                'updated_at' => now(),
            ]);

        return response()->json([
            'message' => 'Your email address has been successfully updated.',
            'user' => $user,
        ]);
    }

    public function updatePassword(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'confirmed', 'min:8'],
        ]);

        if (!Hash::check($validated['current_password'], $user->password_hash)) {
            return response()->json([
                'message' => 'The provided password is incorrect.',
            ], 422);
        }

        $user->password_hash = Hash::make($validated['password']);
        $user->save();

        return response()->json([
            'message' => 'Password updated successfully.',
        ]);
    }

    /**
     * Redirect to Google OAuth.
     */
    public function redirectToGoogle()
    {
        $clientId = config('services.google.client_id') ?: env('GOOGLE_CLIENT_ID');
        $redirectUri = config('services.google.redirect') ?: env('GOOGLE_REDIRECT_URI');

        if (empty($clientId) || empty($redirectUri)) {
            return response()->json([
                'message' => 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI environment variables.',
            ], 500);
        }

        $url = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => $redirectUri,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'access_type' => 'offline',
            'prompt' => 'consent',
        ]);

        return response()->json(['redirect' => $url]);
    }

    /**
     * Handle the Google OAuth callback.
     */
    public function handleGoogleCallback(Request $request)
    {
        // Defensive guard: ensure Google OAuth is configured before proceeding
        $clientId = config('services.google.client_id') ?: env('GOOGLE_CLIENT_ID');
        $clientSecret = config('services.google.client_secret') ?: env('GOOGLE_CLIENT_SECRET');

        if (empty($clientId) || empty($clientSecret)) {
            return response()->json([
                'message' => 'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables.',
            ], 500);
        }

        $code = $request->input('code');

        if (!$code) {
            return response()->json([
                'message' => 'Authorization code not provided.',
            ], 400);
        }

        try {
            // Get access token from Google using the code
            $http = \Illuminate\Support\Facades\Http::asForm();
            $tokenResponse = $http->post('https://oauth2.googleapis.com/token', [
                'client_id' => $clientId,
                'client_secret' => $clientSecret,
                'redirect_uri' => config('services.google.redirect') ?: env('GOOGLE_REDIRECT_URI'),
                'grant_type' => 'authorization_code',
                'code' => $code,
            ]);

            if ($tokenResponse->failed()) {
                return response()->json([
                    'message' => 'Failed to obtain access token from Google.',
                ], 400);
            }

            $accessToken = $tokenResponse->json('access_token');

            // Fetch user info from Google
            $userInfoResponse = \Illuminate\Support\Facades\Http::withToken($accessToken)
                ->get('https://www.googleapis.com/oauth2/v2/userinfo');

            if ($userInfoResponse->failed()) {
                return response()->json([
                    'message' => 'Failed to retrieve user info from Google.',
                ], 400);
            }

            $googleUser = $userInfoResponse->json();
            $googleUserId = $googleUser['id'] ?? null;
            $googleEmail = $googleUser['email'] ?? null;
            $googleName = $googleUser['name'] ?? '';
            $googleAvatar = $googleUser['picture'] ?? null;

            if (!$googleEmail) {
                return response()->json([
                    'message' => 'Could not retrieve email from Google.',
                ], 400);
            }

            // Check if user exists with Google ID (handle missing column gracefully)
            try {
                $user = User::where('google_id', $googleUserId)->first();
            } catch (\Exception $e) {
                // Column might not exist yet — fall back to email-only lookup
                $user = null;
            }

            // Check if a soft-deleted user exists with the same Google ID or email
            if (!$user) {
                $deletedUser = null;
                try {
                    $deletedUser = User::withTrashed()->where('google_id', $googleUserId)->first();
                    if (!$deletedUser && $googleEmail) {
                        $deletedUser = User::withTrashed()->where('email', $googleEmail)->first();
                    }
                } catch (\Exception $e) {
                    // Ignore — continue with creation
                }

                if ($deletedUser) {
                    // User previously deleted their account — don't allow re-registration
                    return response()->json([
                        'message' => 'This account was previously deleted and cannot be restored. Please contact support.',
                    ], 403);
                }
            }

            // If not found by Google ID, try to find by email
            if (!$user && $googleEmail) {
                $user = User::where('email', $googleEmail)->first();
                if ($user) {
                    // Link Google ID to existing user (if column exists)
                    try {
                        $user->google_id = $googleUserId;
                        $user->save();
                    } catch (\Exception $e) {
                        // Column doesn't exist — log but continue
                    }
                }
            }

            // Create new user if not found (JIT automatic registration)
            if (!$user) {
                // Check which columns exist to avoid SQL errors
                $columns = \DB::connection()
                    ->select("SELECT column_name FROM information_schema.columns WHERE table_name = 'users'");
                $columnNames = array_map(fn($c) => $c->column_name, $columns);

                $newUserData = [
                    'full_name' => $googleName ?: explode('@', $googleEmail)[0],
                    'email' => $googleEmail,
                    'password_hash' => Hash::make(Str::random(24)), // Secure random placeholder
                    'role' => 'staff', // Default role for Google-registered users
                    // barangay is left null — user will select it in a follow-up step
                ];

                if (in_array('google_id', $columnNames)) {
                    $newUserData['google_id'] = $googleUserId;
                }
                if (in_array('email_verified_at', $columnNames)) {
                    $newUserData['email_verified_at'] = now(); // Google has already verified the email
                }
                if ($googleAvatar && in_array('avatar', $columnNames)) {
                    $newUserData['avatar'] = $googleAvatar; // Store Google profile picture
                }

                $user = User::create($newUserData);

                // Generate token for immediate access, but flag that barangay setup is needed
                $expiresAt = now()->addDays(30);
                $token = $user->createToken('spa-token', ['*'], $expiresAt)->plainTextToken;

                return response()->json([
                    'token' => $token,
                    'user' => $user,
                    'expires_at' => $expiresAt->toDateTimeString(),
                    'requires_barangay_setup' => true,
                    'message' => 'Account created. Please select your barangay to continue.',
                ], 201);
            }

            // Generate API token with 30-day expiry
            $expiresAt = now()->addDays(30);
            $token = $user->createToken('spa-token', ['*'], $expiresAt)->plainTextToken;

            return response()->json([
                'token' => $token,
                'user' => $user,
                'expires_at' => $expiresAt->toDateTimeString(),
            ]);
        } catch (\Exception $e) {
            \Log::error('Google OAuth error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'code' => $e->getCode(),
            ]);
            return response()->json([
                'message' => 'Google authentication failed. Please try again.',
                'error_detail' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get all barangays.
     */
    public function getBarangays(Request $request)
    {
        $barangays = Barangay::orderBy('name')->get(['id', 'name']);
        return response()->json($barangays);
    }

    /**
     * Create a new barangay (admin only).
     */
    public function createBarangay(Request $request)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:barangays,name'],
        ]);

        $barangay = Barangay::create($validated);
        return response()->json($barangay, 201);
    }
}
}
