<?php

namespace App\Http\Controllers;

use App\Mail\RegistrationApproved;
use App\Mail\RegistrationRejected;
use App\Models\Notification;
use App\Models\RegistrationRequest;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class RegistrationController extends Controller
{
    /**
     * Public lookup: Get registration request details by email.
     * No authentication required - returns request status if found.
     */
    public function lookup(Request $request)
    {
        $email = $request->query('email');

        if (!$email) {
            return response()->json(['message' => 'Email parameter is required.'], 400);
        }

        $registrationRequest = RegistrationRequest::where('email', $email)->first();

        if ($registrationRequest) {
            return response()->json([
                'request_id' => $registrationRequest->request_id,
                'email' => $registrationRequest->email,
                'full_name' => $registrationRequest->full_name,
                'barangay' => $registrationRequest->barangay,
                'role' => $registrationRequest->role,
                'status' => $registrationRequest->status,
                'reviewed_at' => $registrationRequest->reviewed_at,
            ], 200);
        } else {
            return response()->json(['message' => 'No registration request found for this email.'], 404);
        }
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

            // Check if user already exists with this email
            $existing = User::where('email', $registrationRequest->email)->first();
            if ($existing) {
                DB::rollBack();

                return response()->json([
                    'message' => 'A user with this email already exists.',
                ], 422);
            }

            // Create the actual user account
            $newUser = User::create([
                'full_name' => $registrationRequest->full_name,
                'email' => $registrationRequest->email,
                'password_hash' => $registrationRequest->password_hash,
                'role' => $registrationRequest->role,
                'barangay' => $registrationRequest->barangay,
                'department' => $registrationRequest->department,
                'google_id' => $registrationRequest->google_id,
                'avatar' => $registrationRequest->avatar,
                'email_verified_at' => now(),
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

            // Send approval email to the user
            try {
                Mail::to($newUser->email)
                    ->cc($user->email)
                    ->send(new RegistrationApproved($registrationRequest, $newUser, $user));
            } catch (\Exception $mailErr) {
                \Log::warning('Registration approval email failed: '.$mailErr->getMessage());
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

        // Send rejection email to the applicant (no user account exists yet)
        try {
            Mail::to($registrationRequest->email)
                ->cc($user->email)
                ->send(new RegistrationRejected($registrationRequest, $user));
        } catch (\Exception $mailErr) {
            \Log::warning('Registration rejection email failed: '.$mailErr->getMessage());
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
