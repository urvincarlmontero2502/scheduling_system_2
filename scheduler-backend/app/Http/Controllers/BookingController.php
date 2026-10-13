<?php

namespace App\Http\Controllers;

use App\Models\Approval;
use App\Models\BookingRequest;
use App\Models\Notification;
use App\Models\Resource;
use App\Models\User;
use App\Mail\BookingApproved;
use App\Mail\BookingRejected;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use Exception;

class BookingController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Dashboard Statistics
    |--------------------------------------------------------------------------
    */

    public function stats()
    {
        return response()->json([
            'pending' => BookingRequest::notSpecialEvent()
                ->where('status', 'pending')
                ->count(),
            'approved' => BookingRequest::notSpecialEvent()
                ->where('status', 'approved')
                ->count(),
            'resources' => Resource::count(),
        ]);
    }


    /*
    |--------------------------------------------------------------------------
    | Get All Bookings
    |--------------------------------------------------------------------------
    */

    public function index(Request $request)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $query = BookingRequest::with([
                'resource',
                'user'
            ]);

            $bookings = $query
                ->latest('booking_id')
                ->get();

            $formatted = $bookings->map(function ($b) {
                return [
                    'id' => $b->booking_id,
                    'resource_id' => $b->resource_id,
                    'resource' => $b->resource->name ?? 'Unknown Resource',
                    'full_name' => $b->full_name && $b->full_name !== ($b->user->name ?? null) ? $b->full_name : '—',
                    'requester' => $b->full_name && $b->full_name !== ($b->user->name ?? null) ? $b->full_name : '—',
                    'barangay' => $b->user->barangay ?? $b->user->name ?? 'Poblacion',
                    'cell_number' => $b->cell_number ?? 'N/A',
                    'where_do_you_live' => $b->address ?? 'N/A',
                    'address' => $b->address ?? 'N/A',
                    'purpose' => $b->purpose ?? 'No purpose provided',
                    'start_date' => \Carbon\Carbon::parse($b->start_date)->toDateString(),
                    'end_date' => \Carbon\Carbon::parse($b->end_date)->toDateString(),
                    'date' => \Carbon\Carbon::parse($b->start_date)->toDateString() . ' to ' . \Carbon\Carbon::parse($b->end_date)->toDateString(),
                    'start_time' => $b->start_time,
                    'end_time' => $b->end_time,
                    'time' => ($b->start_time && $b->end_time) ? "{$b->start_time} - {$b->end_time}" : 'All Day',
                    'status' => $b->status,
                    'is_special_event' => $b->is_special_event ?? false,
                ];
            });

            return response()->json($formatted);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to fetch bookings: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to fetch bookings.'], 500);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Check Availability & Get Suggested Slots
    |--------------------------------------------------------------------------
    |
    | Given a resource and date, return all available time slots that
    | match (or exceed) the requested duration. Used by the frontend
    | to power the "suggested times" recommendation engine.
    */
    public function availability(Request $request)
    {
        $resourceId = $request->input('resource_id')
            ?? $request->input('item_id')
            ?? null;

        $date = $request->input('date');
        if (!$date) {
            return response()->json(['message' => 'Date is required'], 422);
        }

        $startMins = $this->timeToMinutes($request->input('start_time'));
        $endMins = $this->timeToMinutes($request->input('end_time'));

        $slots = $this->findAvailableSlots($resourceId, $date, $startMins, $endMins);

        return response()->json([
            'date' => $date,
            'available_slots' => $slots,
        ]);
    }

    /*
    |--------------------------------------------------------------------------
    | Create Booking
    |--------------------------------------------------------------------------
    */

    public function store(Request $request)
    {
        try {
            $validated = $request->validate([
                'resource_id' => [
                    'nullable',
                    'exists:resources,resource_id'
                ],

                'item_id' => [
                    'nullable',
                    'exists:resources,resource_id'
                ],

                'full_name' => [
                    'nullable',
                    'string'
                ],

                'start_date' => [
                    'required',
                    'date'
                ],

                'end_date' => [
                    'required',
                    'date',
                    'after_or_equal:start_date'
                ],

                'start_time' => [
                    'nullable',
                    'string'
                ],

                'end_time' => [
                    'nullable',
                    'string'
                ],

                'purpose' => [
                    'nullable',
                    'string'
                ],

                'cell_number' => [
                    'nullable',
                    'string'
                ],

                'address' => [
                    'nullable',
                    'string'
                ],
                'status' => [
                    'nullable',
                    'in:pending,approved,rejected'
                ],
            ]);

            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            /*
            |--------------------------------------------------------------------------
            | Determine Resource ID
            |--------------------------------------------------------------------------
            */

            $resourceId =
                $validated['resource_id']
                ?? $validated['item_id']
                ?? null;

            // Block requests that overlap an already approved booking
            $conflict = $this->findApprovedConflict(
                $resourceId,
                $validated['start_date'],
                $validated['end_date'],
                $validated['start_time'] ?? null,
                $validated['end_time'] ?? null
            );

            if ($conflict) {
                $suggestedSlots = $this->findAvailableSlots(
                    $resourceId,
                    $validated['start_date'],
                    $validated['end_time']
                        ? $this->timeToMinutes($validated['start_time'])
                        : null,
                    $validated['end_time']
                        ? $this->timeToMinutes($validated['end_time'])
                        : null
                );

                return response()->json([
                    'message' => 'This resource is already booked (approved) for the selected date and time.',
                    'conflicting_booking' => [
                        'start_date' => $conflict->start_date,
                        'end_date' => $conflict->end_date,
                        'start_time' => $conflict->start_time,
                        'end_time' => $conflict->end_time,
                        'full_name' => $conflict->full_name,
                        'purpose' => $conflict->purpose,
                    ],
                    'suggested_slots' => $suggestedSlots,
                ], 409);
            }

            /*
            |--------------------------------------------------------------------------
            | Create Booking
            |--------------------------------------------------------------------------
            */

            $booking = BookingRequest::create([
                'user_id' => $user->user_id,
                'resource_id' => $resourceId,
                'full_name' => $validated['full_name'] ?? $user->full_name,
                'purpose' => $validated['purpose'] ?? null,
                'start_date' => $validated['start_date'],
                'end_date' => $validated['end_date'],
                'start_time' => $validated['start_time'] ?? null,
                'end_time' => $validated['end_time'] ?? null,
                'cell_number' => $validated['cell_number'] ?? null,
                'address' => $validated['address'] ?? null,
                'status' => $validated['status'] ?? 'pending',
            ]);

            // Notify administrators of new pending booking request
            $admins = User::where('role', 'admin')->get();
            $resource = $booking->resource;
            $resourceName = $resource ? $resource->name : 'Unknown';
            $requesterName = $booking->full_name ?? ($user->full_name ?? 'Unknown');

            foreach ($admins as $admin) {
                Notification::create([
                    'booking_id' => $booking->booking_id,
                    'user_id' => $admin->user_id,
                    'type' => 'BOOKING_REQUEST',
                    'title' => 'New Booking Request',
                    'message' => "{$requesterName} requested '{$resourceName}' ({$booking->start_date} to {$booking->end_date}).",
                    'is_read' => false,
                ]);
            }

            return response()->json(
                $booking->load(['resource', 'user']),
                201
            );
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to create booking: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to create booking. Please try again.'], 500);
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Approve / Reject Booking
    |--------------------------------------------------------------------------
    */

    public function updateStatus(
        Request $request,
        BookingRequest $booking
    ) {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $validated = $request->validate([
                'status' => [
                    'required',
                    'in:approved,rejected'
                ],

                'remarks' => [
                    'nullable',
                    'string'
                ],
            ]);

            if ($validated['status'] === 'approved') {
                $conflict = $this->findApprovedConflict(
                    $booking->resource_id,
                    Carbon::parse($booking->start_date)->toDateString(),
                    Carbon::parse($booking->end_date)->toDateString(),
                    $booking->start_time,
                    $booking->end_time,
                    $booking->booking_id
                );

                if ($conflict) {
                    return response()->json([
                        'message' => 'This resource is already booked (approved) for that date and time.',
                    ], 422);
                }
            }

            $booking->update([
                'status' => $validated['status']
            ]);

            Approval::create([
                'booking_id' => $booking->booking_id,
                'admin_id' => $user->user_id,
                'action' => $validated['status'],
                'remarks' => $validated['remarks'] ?? null,
            ]);

            Notification::create([
                'booking_id' => $booking->booking_id,
                'user_id' => $booking->user_id,
                'message' => "Your booking request has been {$validated['status']}.",
                'is_read' => false,
                'type' => $validated['status'] === 'approved' ? 'BOOKING_APPROVED' : 'BOOKING_REJECTED',
                'title' => $validated['status'] === 'approved' ? 'Booking Approved' : 'Booking Rejected',
            ]);

            try {
                $requester = User::find($booking->user_id);
                $resource = $booking->resource;
                $resourceName = $resource ? $resource->name : 'Unknown Resource';

                if ($requester && $requester->email) {
                    if ($validated['status'] === 'approved') {
                        Mail::to($requester->email)->send(new BookingApproved($booking, $requester));
                    } else {
                        Mail::to($requester->email)->send(new BookingRejected($booking, $requester));
                    }
                }
            } catch (Exception $e) {
                Log::warning('Failed to send booking status email: ' . $e->getMessage());
            }

            return response()->json($booking);
        } catch (\Exception $e) {
            Log::error('Failed to update booking status: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to update booking status.'], 500);
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Delete Booking
    |--------------------------------------------------------------------------
    */

    public function destroy(Request $request, $id)
    {
        try {
            $user = $request->user();
            if (!$user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $booking = BookingRequest::find($id);
            if (!$booking) {
                return response()->json([
                    'message' => 'Booking already deleted or not found.'
                ], 404);
            }

            $booking->delete();

            return response()->json([
                'message' => 'Booking deleted successfully.'
            ]);
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Failed to delete booking: ' . $e->getMessage());
            return response()->json(['message' => 'Failed to delete booking.'], 500);
        }
    }

    /**
     * Find an approved booking of the same resource that overlaps
     * the given dates AND daily time window (missing times = all day).
     */
    private function findApprovedConflict(
        $resourceId,
        $startDate,
        $endDate,
        $startTime,
        $endTime,
        $ignoreId = null
    ) {
        if (!$resourceId) {
            return null;
        }

        $candidates = BookingRequest::where('resource_id', $resourceId)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate)
            ->when($ignoreId, fn ($q) => $q->where('booking_id', '!=', $ignoreId))
            ->get();

        $newStart = $this->timeToMinutes($startTime);
        $newEnd = $this->timeToMinutes($endTime);

        foreach ($candidates as $c) {
            $s = $this->timeToMinutes($c->start_time);
            $e = $this->timeToMinutes($c->end_time);

            if ($newStart === null || $newEnd === null || $s === null || $e === null) {
                return $c;
            }

            if (max($newStart, $s) < min($newEnd, $e)) {
                return $c;
            }
        }

        return null;
    }

    private function timeToMinutes($time)
    {
        if (!$time) {
            return null;
        }

        $t = strtotime($time);
        if ($t === false) {
            return null;
        }

        return ((int) date('G', $t)) * 60 + (int) date('i', $t);
    }

    /**
     * Find available time slots on a given date that are long enough
     * for the requested duration.
     */
    private function findAvailableSlots($resourceId, $date, $reqStartMins = null, $reqEndMins = null)
    {
        if (!$resourceId) {
            return [];
        }

        // Default business hours if no specific time was requested
        if ($reqStartMins === null && $reqEndMins === null) {
            $reqStartMins = 8 * 60;   // 08:00
            $reqEndMins = 18 * 60;    // 18:00
        }

        $duration = ($reqEndMins ?? 18 * 60) - ($reqStartMins ?? 8 * 60);
        if ($duration <= 0) {
            $duration = 60; // fallback to 1-hour slot
        }

        // Get all approved bookings that touch the requested date
        $bookings = BookingRequest::where('resource_id', $resourceId)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $date)
            ->whereDate('end_date', '>=', $date)
            ->orderBy('start_date')
            ->get();

        // Build busy intervals for the day
        $dayStart = 0;      // midnight
        $dayEnd = 24 * 60;  // midnight next day
        $intervals = [];

        foreach ($bookings as $b) {
            $bStartMins = $this->timeToMinutes($b->start_time);
            $bEndMins = $this->timeToMinutes($b->end_time);

            if ($bStartMins === null || $bEndMins === null) {
                // All-day booking — occupies the entire day
                $intervals[] = [$dayStart, $dayEnd];
                break;
            }

            // Clamp to the requested date's boundaries
            $intervals[] = [
                max($dayStart, $bStartMins),
                min($dayEnd, $bEndMins),
            ];
        }

        // Sort intervals by start time
        usort($intervals, fn ($a, $b) => $a[0] <=> $b[0]);

        // Merge overlapping intervals
        $merged = [];
        foreach ($intervals as $iv) {
            if (empty($merged) || $merged[count($merged) - 1][1] < $iv[0]) {
                $merged[] = $iv;
            } else {
                $merged[count($merged) - 1][1] = max($merged[count($merged) - 1][1], $iv[1]);
            }
        }

        // Walk business hours and find gaps >= duration
        $searchStart = max($dayStart, (int) ($reqStartMins ?? 8 * 60));
        $searchEnd = min($dayEnd, (int) ($reqEndMins ?? 18 * 60));
        $available = [];

        foreach ($merged as $busy) {
            $gapStart = $searchStart;
            $gapEnd = min($busy[0], $searchEnd);

            if ($gapEnd - $gapStart >= $duration) {
                $available[] = [
                    'date' => $date,
                    'start_time' => $this->minutesToTime($gapStart),
                    'end_time' => $this->minutesToTime($gapStart + $duration),
                    'duration_minutes' => $duration,
                ];
            }

            $searchStart = max($searchStart, $busy[1]);
            if ($searchStart >= $searchEnd) {
                break;
            }
        }

        // Check final gap after last booking
        if ($searchStart < $searchEnd && ($searchEnd - $searchStart) >= $duration) {
            $available[] = [
                'date' => $date,
                'start_time' => $this->minutesToTime($searchStart),
                'end_time' => $this->minutesToTime($searchStart + $duration),
                'duration_minutes' => $duration,
            ];
        }

        return $available;
    }

    /**
     * Convert minutes-since-midnight to "HH:MM" format.
     */
    private function minutesToTime($mins)
    {
        $hours = (int) floor($mins / 60);
        $minutes = $mins % 60;
        return sprintf('%02d:%02d', $hours, $minutes);
    }
}
