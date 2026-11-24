<?php

namespace App\Http\Controllers;

use App\Mail\RegistrationApproved;
use App\Mail\RegistrationRejected;
use App\Models\Notification;
use App\Models\RegistrationRequest;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Schema;

class RegistrationController extends Controller
{
    /**
     * Submit a staff registration request for admin approval.
     */
    public function store(Request $request)
    {
        $email = mb_strtolower(trim((string) $request->input('email', '')));
        $cellNumber = $this->normalizePhilippineCellNumber(
            (string) $request->input('cell_number', '')
        );
        $request->merge([
            'email' => $email !== '' ? $email : null,
            'cell_number' => $cellNumber !== '' ? $cellNumber : null,
        ]);

        $validated = $request->validate([
            'first_name' => ['required', 'string', 'max:100'],
            'middle_name' => ['nullable', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'email' => ['nullable', 'required_without:cell_number', 'email', 'max:255'],
            'cell_number' => [
                'nullable',
                'required_without:email',
                'regex:/^09\d{9}$/',
            ],
            'password' => ['required', 'string', 'min:8', 'max:128', 'confirmed'],
            'barangay' => ['required', 'string', 'max:255', 'exists:barangays,name'],
        ]);

        $email = $validated['email'] ?? null;
        $cellNumber = $validated['cell_number'] ?? null;
        $existingUser = User::withTrashed()
            ->where(function ($query) use ($email, $cellNumber) {
                if ($email) {
                    $query->whereRaw('LOWER(email) = ?', [$email]);
                }
                if ($cellNumber) {
                    $query->orWhere('cell_number', $cellNumber);
                }
            })
            ->first();
        if ($existingUser) {
            return response()->json([
                'message' => $existingUser->trashed()
                    ? 'This email or cell number belongs to a removed account. Contact a Super Admin to restore access.'
                    : 'An account with this email or cell number already exists. Please sign in instead.',
            ], 409);
        }

        $existingRequest = RegistrationRequest::query()
            ->where(function ($query) use ($email, $cellNumber) {
                if ($email) {
                    $query->whereRaw('LOWER(email) = ?', [$email]);
                }
                if ($cellNumber) {
                    $query->orWhere('cell_number', $cellNumber);
                }
            })
            ->first();
        if ($existingRequest && $existingRequest->status !== 'rejected') {
            return response()->json([
                'message' => $existingRequest->status === 'pending'
                    ? ($existingRequest->email
                        ? 'A registration request for this email is already pending approval.'
                        : 'A registration request for this cell number is already pending approval.')
                    : ($existingRequest->email
                        ? 'A registration request for this email has already been approved.'
                        : 'A registration request for this cell number has already been approved.'),
            ], 409);
        }

        $fullName = implode(' ', array_filter(array_map('trim', [
            $validated['first_name'],
            $validated['middle_name'] ?? '',
            $validated['last_name'],
        ]), fn ($part) => $part !== ''));

        try {
            $registrationRequest = DB::transaction(function () use ($validated, $email, $cellNumber, $fullName, $existingRequest) {
                $data = [
                    'full_name' => $fullName,
                    'email' => $email,
                    'cell_number' => $cellNumber,
                    'password_hash' => Hash::make($validated['password']),
                    'google_id' => null,
                    'avatar' => null,
                    'barangay' => $validated['barangay'],
                    'department' => null,
                    'role' => 'staff',
                    'status' => 'pending',
                    'reject_reason' => null,
                    'reviewed_by' => null,
                    'reviewed_at' => null,
                ];

                $registrationRequest = $existingRequest ?? new RegistrationRequest;
                $registrationRequest->fill($data);
                $registrationRequest->save();

                if (Schema::hasTable('notifications')) {
                    $contact = $email ?: $cellNumber;
                    $message = "New registration request from {$fullName} ({$contact}) for Brgy. {$validated['barangay']}.";
                    $adminEmail = RegistrationRequest::getAdminEmail($validated['barangay']);
                    $barangayAdmin = $adminEmail
                        ? User::where('email', $adminEmail)
                            ->whereIn('role', ['admin', 'barangay_admin'])
                            ->first()
                        : null;

                    if ($barangayAdmin) {
                        DB::table('notifications')->insert([
                            'user_id' => $barangayAdmin->user_id,
                            'booking_id' => null,
                            'message' => $message,
                            'type' => 'registration_request',
                            'title' => 'New Registration Request',
                            'is_read' => false,
                            'created_at' => now(),
                        ]);
                    }

                    $mainAdmin = User::where('role', 'admin')->first();
                    if ($mainAdmin && $mainAdmin->user_id !== ($barangayAdmin->user_id ?? null)) {
                        DB::table('notifications')->insert([
                            'user_id' => $mainAdmin->user_id,
                            'booking_id' => null,
                            'message' => $message,
                            'type' => 'registration_request',
                            'title' => 'New Registration Request',
                            'is_read' => false,
                            'created_at' => now(),
                        ]);
                    }
                }

                return $registrationRequest;
            });
        } catch (QueryException $e) {
            if (in_array((string) $e->getCode(), ['23000', '23505'], true)) {
                return response()->json([
                    'message' => 'A registration request for this email or cell number already exists.',
                ], 409);
            }

            throw $e;
        }

        return response()->json([
            'message' => 'Your registration request has been submitted for approval. You will be notified once an admin reviews your request.',
            'registration_request_id' => $registrationRequest->request_id,
            'status' => 'pending',
        ], 201);
    }

    /**
     * Send a one-time email link before disclosing email registration status.
     */
    public function lookup(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
        ]);
        $email = mb_strtolower(trim($validated['email']));
        $rateLimitKey = 'registration-status-email:'.hash('sha256', $email);
        $responseMessage = 'If a registration request exists for this address, verification instructions will be sent.';

        if (RateLimiter::tooManyAttempts($rateLimitKey, 3)) {
            return response()->json([
                'message' => 'Too many verification requests. Please try again later.',
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 900);

        DB::table('registration_status_verifications')
            ->where('expires_at', '<=', now())
            ->delete();
        DB::table('registration_status_verifications')
            ->where('email', $email)
            ->delete();

        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        DB::table('registration_status_verifications')->insert([
            'email' => $email,
            'token_hash' => $tokenHash,
            'expires_at' => now()->addMinutes(15),
            'created_at' => now(),
        ]);

        $verificationUrl = rtrim(config('app.frontend_url'), '/')
            .'/registration-status?'.http_build_query([
                'email' => $email,
                'token' => $token,
            ]);

        try {
            Mail::raw(
                "A request was made to check registration status for this email address.\n\n"
                ."If you submitted a registration request, verify ownership of this address using the link below. "
                ."The link expires in 15 minutes and can only be used once:\n"
                .$verificationUrl."\n\n"
                ."If you did not request this, you can ignore this email.",
                function ($message) use ($email) {
                    $message->to($email)
                        ->subject('Verify Your Registration Status Request');
                }
            );
        } catch (\Throwable $exception) {
            DB::table('registration_status_verifications')
                ->where('token_hash', $tokenHash)
                ->delete();
            RateLimiter::clear($rateLimitKey);
            Log::error('Failed to send registration status verification email.', [
                'exception' => $exception::class,
            ]);

            return response()->json([
                'message' => 'We could not send a verification email. Please try again later.',
            ], 503);
        }

        return response()->json(['message' => $responseMessage], 202);
    }

    /**
     * Consume an email verification link and return status only to its owner.
     */
    public function verifyLookup(Request $request)
    {
        $validated = $request->validate([
            'email' => ['required', 'email', 'max:255'],
            'token' => ['required', 'regex:/^[a-f0-9]{64}$/'],
        ]);
        $email = mb_strtolower(trim($validated['email']));
        $tokenHash = hash('sha256', $validated['token']);

        $result = DB::transaction(function () use ($email, $tokenHash) {
            $verification = DB::table('registration_status_verifications')
                ->where('email', $email)
                ->where('token_hash', $tokenHash)
                ->where('expires_at', '>', now())
                ->lockForUpdate()
                ->first();

            if (! $verification) {
                return ['valid' => false];
            }

            $consumed = DB::table('registration_status_verifications')
                ->where('id', $verification->id)
                ->where('expires_at', '>', now())
                ->delete();
            if ($consumed !== 1) {
                return ['valid' => false];
            }

            return [
                'valid' => true,
                'registration' => RegistrationRequest::whereRaw('LOWER(email) = ?', [$email])->first(),
            ];
        });

        if (! $result['valid']) {
            return response()->json([
                'message' => 'This verification link is invalid, expired, or already used. Request a new link.',
            ], 422);
        }

        if (! $result['registration']) {
            return response()->json([
                'message' => 'No registration request was found for this verified email address.',
            ], 404);
        }

        return response()->json([
            'status' => $result['registration']->status,
            'reviewed_at' => $result['registration']->reviewed_at,
        ]);
    }

    /**
     * Verify a cell-number registration status using the password chosen at sign-up.
     */
    public function verifyCellNumberLookup(Request $request)
    {
        $cellNumber = $this->normalizePhilippineCellNumber(
            (string) $request->input('cell_number', '')
        );
        $request->merge(['cell_number' => $cellNumber]);

        $validated = $request->validate([
            'cell_number' => ['required', 'regex:/^09\d{9}$/'],
            'password' => ['required', 'string', 'max:128'],
        ]);
        $rateLimitKey = 'registration-status-cell:'.hash(
            'sha256',
            $validated['cell_number'].'|'.$request->ip()
        );

        if (RateLimiter::tooManyAttempts($rateLimitKey, 5)) {
            return response()->json([
                'message' => 'Too many verification attempts. Please try again later.',
            ], 429);
        }
        RateLimiter::hit($rateLimitKey, 900);

        $registration = RegistrationRequest::where(
            'cell_number',
            $validated['cell_number']
        )->first();

        if (! $registration || ! Hash::check($validated['password'], $registration->password_hash)) {
            return response()->json([
                'message' => 'The cell number or password is incorrect.',
            ], 422);
        }

        return response()->json([
            'status' => $registration->status,
            'reviewed_at' => $registration->reviewed_at,
        ]);
    }

    private function normalizePhilippineCellNumber(string $cellNumber): string
    {
        $digits = preg_replace('/\D+/', '', $cellNumber) ?? '';

        if (str_starts_with($digits, '63') && strlen($digits) === 12) {
            return '0'.substr($digits, 2);
        }

        return $digits;
    }

    /**
     * Get all pending registration requests.
     * Admin sees all; barangay_admin sees only their barangay.
     */
    public function index(Request $request)
    {
        $user = $request->user();

        $query = RegistrationRequest::where('status', 'pending')
            ->orderBy('created_at', 'desc');

        // Barangay admins only see requests from their barangay
        if ($user->role === 'barangay_admin') {
            $query->where('barangay', $user->barangay);
        }

        $requests = $query->get();

        return response()->json($requests);
    }

    /**
     * Get all processed (approved/rejected) registration requests.
     * Admin sees all; barangay_admin sees only their barangay.
     */
    public function processed(Request $request)
    {
        $user = $request->user();

        $query = RegistrationRequest::whereIn('status', ['approved', 'rejected'])
            ->orderBy('reviewed_at', 'desc');

        if ($user->role === 'barangay_admin') {
            $query->where('barangay', $user->barangay);
        }

        $requests = $query->get();

        return response()->json($requests);
    }

    /**
     * Approve a registration request.
     * Creates the actual user account and sends a notification.
     */
    public function approve(Request $request, $requestId)
    {
        $user = $request->user();

        $registrationRequest = RegistrationRequest::where('request_id', $requestId)->firstOrFail();

        // Authorization: admin *** approve all; barangay_admin only their barangay
        if ($user->role === 'barangay_admin' && $registrationRequest->barangay !== $user->barangay) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($registrationRequest->status !== 'pending') {
            return response()->json(['message' => 'This request has already been processed.'], 422);
        }

        try {
            DB::beginTransaction();

            // Check whether either registration identifier already belongs to a user.
            $existing = User::withTrashed()
                ->where(function ($query) use ($registrationRequest) {
                    if ($registrationRequest->email) {
                        $query->where('email', $registrationRequest->email);
                    }
                    if ($registrationRequest->cell_number) {
                        $query->orWhere('cell_number', $registrationRequest->cell_number);
                    }
                })
                ->first();
            if ($existing) {
                DB::rollBack();

                return response()->json([
                    'message' => $existing->trashed()
                        ? 'This email or cell number belongs to a removed account. Restore it from the Trash Bin instead of creating a new account.'
                        : 'A user with this email or cell number already exists.',
                ], 422);
            }

            // Create the actual user account
            $newUser = User::create([
                'full_name' => $registrationRequest->full_name,
                'email' => $registrationRequest->email,
                'cell_number' => $registrationRequest->cell_number,
                'password_hash' => $registrationRequest->password_hash,
                'password_setup_required' => (bool) $registrationRequest->password_setup_required,
                'role' => $registrationRequest->role,
                'barangay' => $registrationRequest->barangay,
                'department' => $registrationRequest->department,
                'google_id' => $registrationRequest->google_id,
                'avatar' => $registrationRequest->avatar,
                'email_verified_at' => $registrationRequest->email ? now() : null,
            ]);

            // Mark registration request as approved
            $registrationRequest->status = 'approved';
            $registrationRequest->reviewed_by = $user->user_id;
            $registrationRequest->reviewed_at = now();
            $registrationRequest->save();

            // Create in-app notification for the newly approved user
            DB::table('notifications')->insert([
                'user_id' => $newUser->user_id,
                'booking_id' => null,
                'message' => 'Your account has been approved. You can now log in.',
                'type' => 'registration_approved',
                'title' => 'Account Approved',
                'is_read' => false,
                'created_at' => now(),
            ]);

            // Email is optional for staff accounts registered with a cell number.
            if ($newUser->email) {
                try {
                    Mail::to($newUser->email)
                        ->cc($user->email)
                        ->send(new RegistrationApproved($registrationRequest, $newUser, $user));
                } catch (\Exception $mailErr) {
                    \Log::warning('Registration approval email failed: '.$mailErr->getMessage());
                }
            }

            app(ActivityLogger::class)->record(
                $user,
                'registration.approved',
                sprintf(
                    'Approved registration request #%d for %s.',
                    $registrationRequest->request_id,
                    $registrationRequest->full_name
                ),
                'registration',
                $registrationRequest->request_id,
                [
                    'applicant_name' => $registrationRequest->full_name,
                    'role' => $registrationRequest->role,
                    'barangay' => $registrationRequest->barangay,
                ]
            );

            DB::commit();

            return response()->json([
                'message' => 'Registration approved successfully.',
                'user_id' => $newUser->user_id,
                'request_id' => $registrationRequest->request_id,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'message' => 'Failed to approve registration: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Reject a registration request with an optional reason.
     */
    public function reject(Request $request, $requestId)
    {
        $user = $request->user();

        $registrationRequest = RegistrationRequest::where('request_id', $requestId)->firstOrFail();

        // Authorization: admin can reject all; barangay_admin only their barangay
        if ($user->role === 'barangay_admin' && $registrationRequest->barangay !== $user->barangay) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($registrationRequest->status !== 'pending') {
            return response()->json(['message' => 'This request has already been processed.'], 422);
        }

        $registrationRequest->status = 'rejected';
        $registrationRequest->reject_reason = $request->input('notes');
        $registrationRequest->reviewed_by = $user->user_id;
        $registrationRequest->reviewed_at = now();
        $registrationRequest->save();

        app(ActivityLogger::class)->record(
            $user,
            'registration.rejected',
            sprintf(
                'Rejected registration request #%d for %s.',
                $registrationRequest->request_id,
                $registrationRequest->full_name
            ),
            'registration',
            $registrationRequest->request_id,
            [
                'applicant_name' => $registrationRequest->full_name,
                'role' => $registrationRequest->role,
                'barangay' => $registrationRequest->barangay,
            ]
        );

        // Email is optional for staff accounts registered with a cell number.
        if ($registrationRequest->email) {
            try {
                Mail::to($registrationRequest->email)
                    ->cc($user->email)
                    ->send(new RegistrationRejected($registrationRequest, $user));
            } catch (\Exception $mailErr) {
                \Log::warning('Registration rejection email failed: '.$mailErr->getMessage());
            }
        }

        return response()->json([
            'message' => 'Registration rejected.',
        ]);
    }

    /**
     * Get a single registration request by ID.
     */
    public function show(Request $request, $requestId)
    {
        $user = $request->user();

        $registrationRequest = RegistrationRequest::where('request_id', $requestId)->firstOrFail();

        // Authorization
        if ($user->role === 'barangay_admin' && $registrationRequest->barangay !== $user->barangay) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        return response()->json($registrationRequest);
    }
}
