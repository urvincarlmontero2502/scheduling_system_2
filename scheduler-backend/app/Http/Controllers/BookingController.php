<?php

namespace App\Http\Controllers;

use App\Mail\BookingApproved;
use App\Mail\BookingRejected;
use App\Models\Approval;
use App\Models\BookingRequest;
use App\Models\Notification;
use App\Models\Resource;
use App\Models\User;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

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

            // Barangay admins only see requests from their barangay.
            // Municipal special events belong to the Mayor's Office account
            // (barangay is null), so they must stay visible on every calendar.
            if ($user->isBarangayAdmin()) {
                $query->where(function ($q) use ($user) {
                    $q->where('is_special_event', true)
                        ->orWhereHas('user', function ($inner) use ($user) {
                            $inner->where('barangay', $user->barangay);
                        });
                });
            }

            $bookings = $query
                ->latest('booking_id')
                ->get();

            $formatted = $bookings->map(function ($b) {
                $eventTitle = $b->full_name;
                $ownerName = $b->user?->full_name;
                $displayName = ($b->is_special_event && $eventTitle)
                    ? $eventTitle
                    : (($eventTitle && $eventTitle !== $ownerName) ? $eventTitle : '—');

                return [
                    'id' => $b->booking_id,
                    'resource_id' => $b->resource_id,
                    'resource' => $b->resource?->name ?? 'Unknown Resource',
                    'buffer_minutes' => $b->resource?->buffer_minutes ?? 30,
                    'resource_image' => ($b->resource && $b->resource->image) ? \Illuminate\Support\Facades\Storage::disk('assets')->url($b->resource->image) : null,
                    'full_name' => $displayName,
                    'requester' => $displayName,
                    'barangay' => $b->user?->barangay ?? $b->user?->name ?? 'Poblacion',
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
                    'email' => $b->email ?? ($b->user?->email ?? 'N/A'),
                    'reference_id' => $b->reference_id,
                    'is_special_event' => $b->is_special_event ?? false,
                    'attendees' => $b->attendees,
                    'priority' => $b->priority ?? 'normal',
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

        $bufferMinutes = $this->bufferMinutesForResource($resourceId);
        $slots = $this->findAvailableSlots(
            $resourceId,
            $date,
            $startMins,
            $endMins,
            $bufferMinutes
        );

        return response()->json([
            'date' => $date,
            'available_slots' => $slots,
            'buffer_minutes' => $bufferMinutes,
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
            $minimumBookingDate = now('Asia/Manila')->toDateString();
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
                    'date',
                    'after_or_equal:'.$minimumBookingDate,
                ],

                'end_date' => [
                    'required',
                    'date',
                    'after_or_equal:start_date'
                ],

                'start_time' => [
                    'nullable',
                    'date_format:H:i,H:i:s,g:i A,g:iA,h:i A,h:iA',
                    'required_with:end_time',
                ],

                'end_time' => [
                    'nullable',
                    'date_format:H:i,H:i:s,g:i A,g:iA,h:i A,h:iA',
                    'required_with:start_time',
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

                'email' => ['nullable', 'email', 'string'],

                'status' => [
                    'nullable',
                    'in:pending,approved,rejected'
                ],

                'attendees' => [
                    'nullable',
                    'integer',
                    'min:1',
                ],

                'priority' => [
                    'nullable',
                    'in:normal,high',
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

            // --- Capacity Matching ---
            // If the user specified an attendee count, validate it against
            // the resource capacity (facilities only).
            if (isset($validated['attendees']) && $resourceId) {
                $resource = Resource::find($resourceId);
                if ($resource && $resource->type === 'facility') {
                    $facilityDetail = $resource->facilityDetails;
                    $capacity = $facilityDetail ? $facilityDetail->capacity : null;
                    if ($capacity && $validated['attendees'] > $capacity) {
                        return response()->json([
                            'message' => 'The selected facility cannot accommodate the specified number of attendees.',
                            'capacity' => (int) $capacity,
                            'attendees' => (int) $validated['attendees'],
                            'resource_id' => $resourceId,
                        ], 422);
                    }
                }
            }

            // Block requests that overlap an already approved booking OR
            // if the resource is currently under maintenance
            $resource = $resourceId ? Resource::find($resourceId) : null;

            // Check if resource is in maintenance
            if ($resource && $resource->status === 'maintenance') {
                $alternatives = $this->findAvailableAlternatives(
                    $resource->type,
                    $validated['start_date'],
                    $validated['end_date'],
                    $validated['start_time'] ?? null,
                    $validated['end_time'] ?? null,
                    $resourceId
                );

                return response()->json([
                    'message' => 'The selected resource is unavailable during this time.',
                    'conflict' => true,
                    'reason' => 'maintenance',
                    'alternatives' => $alternatives,
                ], 409);
            }

            $conflict = $this->hasBookingConflict(
                $resourceId,
                $validated['start_date'],
                $validated['end_date'],
                $validated['start_time'] ?? null,
                $validated['end_time'] ?? null
            );

            if ($conflict) {
                $alternatives = [];
                $suggestions = [];
                if ($resourceId && $resource) {
                    $alternatives = $this->findAvailableAlternatives(
                        $resource->type,
                        $validated['start_date'],
                        $validated['end_date'],
                        $validated['start_time'] ?? null,
                        $validated['end_time'] ?? null,
                        $resourceId
                    );
                    $suggestions = $this->findTimeSuggestions(
                        $resourceId,
                        $validated['start_date'],
                        $validated['end_date'],
                        $validated['start_time'] ?? null,
                        $validated['end_time'] ?? null,
                        $conflict
                    );
                }

                return response()->json([
                    'message' => 'The requested time slot conflicts with an existing reservation.',
                    'conflict' => true,
                    'conflicting_booking' => [
                        'start_date' => $conflict->start_date,
                        'end_date' => $conflict->end_date,
                        'start_time' => $conflict->start_time,
                        'end_time' => $conflict->end_time,
                        'full_name' => $conflict->full_name,
                        'purpose' => $conflict->purpose,
                        'status' => $conflict->status,
                    ],
                    'alternatives' => $alternatives,
                    'suggestions' => $suggestions,
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
                'email' => ($validated['email'] ?? null) ?: ($user->email ?? 'N/A'),
                'status' => $validated['status'] ?? 'pending',
                'attendees' => $validated['attendees'] ?? null,
                'priority' => $validated['priority'] ?? 'normal',
            ]);

            // Generate human-readable reference ID: JBG-YYYY-NNNN
            $referenceId = 'JBG-' . date('Y') . '-' . str_pad($booking->booking_id, 4, '0', STR_PAD_LEFT);
            $booking->update(['reference_id' => $referenceId]);

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
        } catch (ValidationException $e) {
            throw $e;
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
                $conflict = $this->hasBookingConflict(
                    $booking->resource_id,
                    Carbon::parse($booking->start_date)->toDateString(),
                    Carbon::parse($booking->end_date)->toDateString(),
                    $booking->start_time,
                    $booking->end_time,
                    $booking->booking_id
                );

                if ($conflict) {
                    return response()->json([
                        'message' => 'This resource is already booked for that date and time.',
                        'conflict' => true,
                        'suggestions' => $this->findTimeSuggestions(
                            $booking->resource_id,
                            Carbon::parse($booking->start_date)->toDateString(),
                            Carbon::parse($booking->end_date)->toDateString(),
                            $booking->start_time,
                            $booking->end_time,
                            $conflict
                        ),
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
     * Check pending and approved bookings using datetime interval overlap.
     * Existing reservations block the resource for its configured buffer
     * before and after their scheduled interval.
     *
     * @param int $resourceId
     * @param string $startDate  (Y-m-d)
     * @param string $endDate    (Y-m-d)
     * @param string|null $startTime  (HH:MM or HH:MM:SS)
     * @param string|null $endTime    (HH:MM or HH:MM:SS)
     * @param int|null $excludeBookingId  Booking ID to exclude (self on update)
     * @return BookingRequest|null  Returns the conflicting booking or null
     */
    private function hasBookingConflict(
        $resourceId,
        $startDate,
        $endDate,
        $startTime,
        $endTime,
        $excludeBookingId = null,
        $bufferMinutes = null
    ) {
        if (!$resourceId) {
            return null;
        }

        $bufferMinutes ??= $this->bufferMinutesForResource($resourceId);
        $bufferDays = intdiv($bufferMinutes, 1440) + ($bufferMinutes > 0 ? 1 : 0);

        [$requestedStart, $requestedEnd] = $this->bookingDateTimeRange(
            $startDate,
            $endDate,
            $startTime,
            $endTime
        );

        $candidates = BookingRequest::where('resource_id', $resourceId)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('start_date', '<=', Carbon::parse($endDate)->addDays($bufferDays)->toDateString())
            ->whereDate('end_date', '>=', Carbon::parse($startDate)->subDays($bufferDays)->toDateString())
            ->when(
                $excludeBookingId !== null,
                fn ($query) => $query->where('booking_id', '!=', $excludeBookingId)
            )
            ->orderBy('start_date')
            ->orderBy('start_time')
            ->get();

        foreach ($candidates as $c) {
            [$existingStart, $existingEnd] = $this->bookingDateTimeRange(
                Carbon::parse($c->start_date)->toDateString(),
                Carbon::parse($c->end_date)->toDateString(),
                $c->start_time,
                $c->end_time
            );
            $blockingStart = $existingStart->copy()->subMinutes($bufferMinutes);
            $blockingEnd = $existingEnd->copy()->addMinutes($bufferMinutes);

            if ($blockingStart->lt($requestedEnd) && $blockingEnd->gt($requestedStart)) {
                return $c;
            }
        }

        return null;
    }

    /**
     * Treat reservations without a complete time pair as all-day bookings.
     */
    private function bookingDateTimeRange($startDate, $endDate, $startTime, $endTime)
    {
        $startDay = Carbon::parse($startDate)->startOfDay();
        $endDay = Carbon::parse($endDate)->startOfDay();

        if (!$startTime || !$endTime) {
            return [$startDay, $endDay->endOfDay()];
        }

        return [
            Carbon::parse($startDate . ' ' . $startTime),
            Carbon::parse($endDate . ' ' . $endTime),
        ];
    }

    /**
     * Suggest a later slot on the requested start date and a later date with
     * the same requested time and duration.
     */
    private function findTimeSuggestions(
        $resourceId,
        $startDate,
        $endDate,
        $startTime,
        $endTime,
        BookingRequest $conflict
    ) {
        $bufferMinutes = $this->bufferMinutesForResource($resourceId);
        [$requestedStart, $requestedEnd] = $this->bookingDateTimeRange(
            $startDate,
            $endDate,
            $startTime,
            $endTime
        );
        $durationSeconds = $requestedStart->diffInSeconds($requestedEnd);
        if ($durationSeconds <= 0) {
            return [];
        }

        $suggestions = [];
        [, $conflictEnd] = $this->bookingDateTimeRange(
            Carbon::parse($conflict->start_date)->toDateString(),
            Carbon::parse($conflict->end_date)->toDateString(),
            $conflict->start_time,
            $conflict->end_time
        );

        $sameDayStart = $requestedStart->copy()->startOfDay();
        $sameDayEnd = $sameDayStart->copy()->endOfDay();
        $candidateStart = $conflictEnd->copy()->addMinutes($bufferMinutes);
        if ($candidateStart->lt($requestedStart)) {
            $candidateStart = $requestedStart->copy();
        }

        while (
            $candidateStart->isSameDay($sameDayStart) &&
            $candidateStart->copy()->addSeconds($durationSeconds)->lte($sameDayEnd)
        ) {
            $candidateEnd = $candidateStart->copy()->addSeconds($durationSeconds);
            $candidateStartTime = $startTime ? $candidateStart->format('H:i:s') : null;
            $candidateEndTime = $endTime ? $candidateEnd->format('H:i:s') : null;
            $nextConflict = $this->hasBookingConflict(
                $resourceId,
                $candidateStart->toDateString(),
                $candidateEnd->toDateString(),
                $candidateStartTime,
                $candidateEndTime,
                null,
                $bufferMinutes
            );

            if (!$nextConflict) {
                $suggestions[] = [
                    'start_time' => $candidateStart->format('Y-m-d H:i:s'),
                    'end_time' => $candidateEnd->format('Y-m-d H:i:s'),
                    'label' => 'Same day, later slot',
                ];
                break;
            }

            [, $nextConflictEnd] = $this->bookingDateTimeRange(
                Carbon::parse($nextConflict->start_date)->toDateString(),
                Carbon::parse($nextConflict->end_date)->toDateString(),
                $nextConflict->start_time,
                $nextConflict->end_time
            );
            $candidateStart = $nextConflictEnd->copy()->addMinutes($bufferMinutes);
        }

        $nextDate = $requestedStart->copy()->addDay()->startOfDay();
        $nextDate->setTime(
            $requestedStart->hour,
            $requestedStart->minute,
            $requestedStart->second
        );

        $lastBookedDate = BookingRequest::where('resource_id', $resourceId)
            ->whereIn('status', ['pending', 'approved'])
            ->max('end_date');
        $lastSearchDate = Carbon::parse($lastBookedDate ?: $startDate)
            ->startOfDay()
            ->addDay();
        if ($lastSearchDate->lt($nextDate)) {
            $lastSearchDate = $nextDate->copy();
        }

        while ($nextDate->lte($lastSearchDate)) {
            $candidateEnd = $nextDate->copy()->addSeconds($durationSeconds);
            $candidateStartTime = $startTime ? $nextDate->format('H:i:s') : null;
            $candidateEndTime = $endTime ? $candidateEnd->format('H:i:s') : null;

            if (!$this->hasBookingConflict(
                $resourceId,
                $nextDate->toDateString(),
                $candidateEnd->toDateString(),
                $candidateStartTime,
                $candidateEndTime,
                null,
                $bufferMinutes
            )) {
                $suggestions[] = [
                    'start_time' => $nextDate->format('Y-m-d H:i:s'),
                    'end_time' => $candidateEnd->format('Y-m-d H:i:s'),
                    'label' => 'Next available day, same time slot',
                ];
                break;
            }

            $nextDate->addDay();
        }

        return $suggestions;
    }

    /**
     * Greedily find available alternative resources of the same type
     * during the requested time window.
     *
     * Iterates through all active resources of the given type (excluding
     * the specified resource), testing each against hasBookingConflict().
     * Returns all candidates that have no conflicts.
     *
     * @param string $resourceType  'vehicle' or 'facility'
     * @param string $startDate
     * @param string $endDate
     * @param string|null $startTime
     * @param string|null $endTime
     * @param int $excludeResourceId  Resource ID to exclude from results
     * @return array
     */
    private function findAvailableAlternatives(
        $resourceType,
        $startDate,
        $endDate,
        $startTime,
        $endTime,
        $excludeResourceId
    ) {
        $candidates = Resource::where('type', $resourceType)
            ->where('status', '!=', 'maintenance')
            ->where('resource_id', '!=', $excludeResourceId)
            ->get(['resource_id', 'name', 'type', 'status', 'buffer_minutes']);

        $alternatives = [];

        foreach ($candidates as $resource) {
            $conflict = $this->hasBookingConflict(
                $resource->resource_id,
                $startDate,
                $endDate,
                $startTime,
                $endTime,
                null,
                $resource->buffer_minutes ?? 30
            );

            if (!$conflict) {
                $alternatives[] = [
                    'resource_id' => $resource->resource_id,
                    'name' => $resource->name,
                    'type' => $resource->type,
                    'status' => $resource->status,
                ];
            }
        }

        return $alternatives;
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
     * for the requested duration. Pending and approved reservations are
     * extended by the resource's buffer on both sides.
     */
    private function findAvailableSlots(
        $resourceId,
        $date,
        $reqStartMins = null,
        $reqEndMins = null,
        $bufferMinutes = 30
    ) {
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

        $dayStartDate = Carbon::parse($date)->startOfDay();
        $dayEndDate = $dayStartDate->copy()->endOfDay();

        $bufferDays = intdiv($bufferMinutes, 1440) + ($bufferMinutes > 0 ? 1 : 0);

        // Include adjacent dates because resource buffers can cross midnight.
        $bookings = BookingRequest::where('resource_id', $resourceId)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('start_date', '<=', $dayStartDate->copy()->addDays($bufferDays)->toDateString())
            ->whereDate('end_date', '>=', $dayStartDate->copy()->subDays($bufferDays)->toDateString())
            ->orderBy('start_date')
            ->get();

        // Build busy intervals for the day, including turnaround buffers.
        $dayStart = 0;
        $dayEnd = 24 * 60;
        $intervals = [];

        foreach ($bookings as $b) {
            [$bookingStart, $bookingEnd] = $this->bookingDateTimeRange(
                Carbon::parse($b->start_date)->toDateString(),
                Carbon::parse($b->end_date)->toDateString(),
                $b->start_time,
                $b->end_time
            );
            $blockingStart = $bookingStart->copy()->subMinutes($bufferMinutes);
            $blockingEnd = $bookingEnd->copy()->addMinutes($bufferMinutes);

            if ($blockingStart->gt($dayEndDate) || $blockingEnd->lt($dayStartDate)) {
                continue;
            }

            $startOffset = (int) floor(
                ($blockingStart->getTimestamp() - $dayStartDate->getTimestamp()) / 60
            );
            $endOffset = (int) ceil(
                ($blockingEnd->getTimestamp() - $dayStartDate->getTimestamp()) / 60
            );
            $intervals[] = [
                max($dayStart, $startOffset),
                min($dayEnd, $endOffset),
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

    private function bufferMinutesForResource($resourceId)
    {
        return (int) (Resource::whereKey($resourceId)->value('buffer_minutes') ?? 30);
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
