<?php

namespace App\Http\Controllers;

use App\Models\BookingRemovalRequest;
use App\Models\BookingRequest;
use App\Models\Notification;
use App\Models\User;
use App\Services\ActivityLogger;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BookingRemovalRequestController extends Controller
{
    public function store(Request $request, BookingRequest $booking): JsonResponse
    {
        $user = $request->user();
        if ($user->isApprover()) {
            return response()->json(['message' => 'Only staff can request booking removal.'], 403);
        }

        if ((int) $booking->user_id !== (int) $user->user_id) {
            return response()->json(['message' => 'You can only request removal of your own bookings.'], 403);
        }

        if ($booking->is_special_event || ! in_array($booking->status, ['pending', 'approved'], true)) {
            return response()->json(['message' => 'Only pending or approved bookings can be submitted for removal.'], 422);
        }

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $existingRequest = BookingRemovalRequest::where('booking_id', $booking->booking_id)
            ->where('status', 'pending')
            ->first();
        if ($existingRequest) {
            return response()->json(['message' => 'A removal request for this booking is already pending.'], 422);
        }

        $resourceName = $booking->resource?->name ?? 'Unknown Resource';
        $requestRecord = BookingRemovalRequest::create([
            'booking_id' => $booking->booking_id,
            'requested_by' => $user->user_id,
            'requester_name' => $user->full_name,
            'requester_role' => $user->role,
            'reason' => $validated['reason'] ?? null,
            'booking_snapshot' => [
                'resource_name' => $resourceName,
                'start_date' => $booking->start_date?->toDateString() ?? $booking->start_date,
                'end_date' => $booking->end_date?->toDateString() ?? $booking->end_date,
                'booking_status' => $booking->status,
                'barangay' => $user->barangay,
            ],
            'status' => 'pending',
            'requested_at' => now(),
        ]);

        $reviewers = User::where('role', 'admin')
            ->orWhere(function ($query) use ($user) {
                $query->where('role', 'barangay_admin')
                    ->where('barangay', $user->barangay);
            })
            ->get();

        foreach ($reviewers as $reviewer) {
            Notification::create([
                'booking_id' => $booking->booking_id,
                'user_id' => $reviewer->user_id,
                'message' => "{$user->full_name} requested removal of {$resourceName} booking #{$booking->booking_id}.",
                'is_read' => false,
                'type' => 'BOOKING_REMOVAL_REQUEST',
                'title' => 'Booking Removal Requested',
                'created_at' => now(),
            ]);
        }

        app(ActivityLogger::class)->record(
            $user,
            'booking.removal_requested',
            sprintf('Requested removal of booking #%d for %s.', $booking->booking_id, $resourceName),
            'booking',
            $booking->booking_id,
            ['booking_status' => $booking->status]
        );

        return response()->json($requestRecord, 201);
    }

    public function showForBooking(Request $request, BookingRequest $booking): JsonResponse
    {
        $user = $request->user();
        if ((int) $booking->user_id !== (int) $user->user_id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $removalRequest = BookingRemovalRequest::where('booking_id', $booking->booking_id)
            ->where('requested_by', $user->user_id)
            ->latest('requested_at')
            ->first();

        return response()->json($removalRequest);
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user->isApprover()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $query = BookingRemovalRequest::with(['booking.resource', 'booking.user', 'reviewer'])
            ->where('status', 'pending')
            ->orderByDesc('requested_at');

        if ($user->isBarangayAdmin()) {
            $query->whereHas('booking.user', fn ($builder) => $builder->where('barangay', $user->barangay));
        }

        return response()->json($query->get());
    }

    public function approve(Request $request, BookingRemovalRequest $removalRequest): JsonResponse
    {
        return $this->review($request, $removalRequest, 'approved');
    }

    public function reject(Request $request, BookingRemovalRequest $removalRequest): JsonResponse
    {
        return $this->review($request, $removalRequest, 'rejected');
    }

    private function review(Request $request, BookingRemovalRequest $removalRequest, string $decision): JsonResponse
    {
        $reviewer = $request->user();
        if (! $reviewer->isApprover()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $validated = $request->validate([
            'review_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $removalRequest->loadMissing(['booking.user', 'booking.resource']);
        $booking = $removalRequest->booking;
        if (! $booking || $removalRequest->status !== 'pending') {
            return response()->json(['message' => 'This removal request is no longer pending.'], 422);
        }
        if ($reviewer->isBarangayAdmin() && $booking->user?->barangay !== $reviewer->barangay) {
            return response()->json(['message' => 'You can only review requests from your barangay.'], 403);
        }
        if ($decision === 'approved' && ! in_array($booking->status, ['pending', 'approved'], true)) {
            return response()->json(['message' => 'This booking can no longer be removed.'], 422);
        }

        DB::transaction(function () use ($removalRequest, $booking, $reviewer, $decision, $validated) {
            $resourceName = $booking->resource?->name ?? 'Unknown Resource';
            $bookingId = $booking->booking_id;
            if ($decision === 'approved') {
                $booking->delete();
                app(ActivityLogger::class)->record(
                    $reviewer,
                    'booking.deleted',
                    sprintf('Removed booking #%d for %s after staff request.', $bookingId, $resourceName),
                    'booking',
                    $bookingId,
                    ['removal_request_id' => $removalRequest->removal_request_id]
                );
            }

            $removalRequest->update([
                'status' => $decision,
                'reviewed_by' => $reviewer->user_id,
                'review_note' => $validated['review_note'] ?? null,
                'reviewed_at' => now(),
            ]);

            $message = $decision === 'approved'
                ? "Your removal request for {$resourceName} booking #{$bookingId} was approved."
                : "Your removal request for {$resourceName} booking #{$bookingId} was declined.";
            Notification::create([
                'booking_id' => $decision === 'approved' ? null : $bookingId,
                'user_id' => $removalRequest->requested_by,
                'message' => $message,
                'is_read' => false,
                'type' => $decision === 'approved' ? 'BOOKING_REMOVAL_APPROVED' : 'BOOKING_REMOVAL_REJECTED',
                'title' => $decision === 'approved' ? 'Removal Request Approved' : 'Removal Request Declined',
                'created_at' => now(),
            ]);

            app(ActivityLogger::class)->record(
                $reviewer,
                "booking.removal_request_{$decision}",
                sprintf('%s removal request #%d for booking #%d.', ucfirst($decision), $removalRequest->removal_request_id, $bookingId),
                'booking_removal_request',
                $removalRequest->removal_request_id,
                ['booking_id' => $bookingId]
            );
        });

        return response()->json(['message' => $decision === 'approved' ? 'Booking removed.' : 'Removal request declined.']);
    }
}
