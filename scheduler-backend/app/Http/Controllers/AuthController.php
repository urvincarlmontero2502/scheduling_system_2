<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
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
}
