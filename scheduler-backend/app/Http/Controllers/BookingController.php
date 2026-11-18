<?php

namespace App\Http\Controllers;

use App\Mail\BookingApproved;
use App\Mail\BookingRejected;
use App\Models\Approval;
use App\Models\BookingRequest;
use App\Models\Notification;
use App\Models\Resource;
use App\Models\User;
use App\Services\ActivityLogger;
use Carbon\Carbon;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class BookingController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Dashboard Statistics
    |--------------------------------------------------------------------------
    */

    public function stats(Request $request)
    {
        $user = $request->user();
        $bookings = BookingRequest::notSpecialEvent();

        if ($user->isBarangayAdmin()) {
            $bookings->whereHas('user', fn ($query) => $query->where('barangay', $user->barangay));
        } elseif (! $user->isAdmin()) {
            $bookings->where('user_id', $user->user_id);
        }

        return response()->json([
            'pending' => (clone $bookings)
                ->where('status', 'pending')
                ->count(),
            'approved' => (clone $bookings)
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
            if (! $user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $query = BookingRequest::with([
                'resource',
                'user',
                'vehicles',
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
            } elseif (! $user->isAdmin()) {
                $query->where('user_id', $user->user_id);
            }

            $bookings = $query
                ->latest('booking_id')
                ->get();

            $formatted = $bookings->map(function ($b) {
                $ownerName = $b->user?->full_name;
                $displayName = $b->full_name ?: ($ownerName ?: '—');
                $vehicles = $this->formatVehicles($b);

                return [
                    'id' => $b->booking_id,
                    'owner_user_id' => $b->user_id,
                    'resource_id' => $b->resource_id,
                    'resource_ids' => array_column($vehicles, 'resource_id'),
                    'resource' => $b->resource?->name ?? 'Unknown Resource',
                    'resource_type' => $b->resource?->type,
                    'price_per_day' => $b->price_per_day ?? $b->resource?->price_per_day,
                    'price_per_hour' => $b->price_per_hour ?? $b->resource?->price_per_hour,
                    'buffer_minutes' => $b->resource?->buffer_minutes ?? 30,
                    'resource_image' => ($b->resource && $b->resource->image) ? Storage::disk('assets')->url($b->resource->image) : null,
                    'vehicles' => $vehicles,
                    'resource_names' => array_column($vehicles, 'name'),
                    'full_name' => $displayName,
                    'requester' => $displayName,
                    'barangay' => $b->user?->barangay ?? $b->user?->name ?? 'Poblacion',
                    'cell_number' => $b->cell_number ?? 'N/A',
                    'where_do_you_live' => $b->address ?? 'N/A',
                    'address' => $b->address ?? 'N/A',
                    'destination' => $b->destination,
                    'purpose' => $b->purpose ?? 'No purpose provided',
                    'start_date' => Carbon::parse($b->start_date)->toDateString(),
                    'end_date' => Carbon::parse($b->end_date)->toDateString(),
                    'date' => Carbon::parse($b->start_date)->toDateString().' to '.Carbon::parse($b->end_date)->toDateString(),
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
        } catch (Exception $e) {
            Log::error('Failed to fetch bookings: '.$e->getMessage());

            return response()->json(['message' => 'Failed to fetch bookings.'], 500);
        }
    }

    public function removed(Request $request)
    {
        $user = $request->user();
        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $query = BookingRequest::onlyTrashed()->with(['resource', 'user', 'vehicles']);
        if ($user->isBarangayAdmin()) {
            $query->whereHas('user', fn ($builder) => $builder->where('barangay', $user->barangay));
        } elseif (! $user->isAdmin()) {
            $query->where('user_id', $user->user_id);
        }

        return response()->json($query->latest('deleted_at')->get()->map(function ($booking) {
            $ownerName = $booking->user?->full_name;
            $displayName = ($booking->full_name && $booking->full_name !== $ownerName)
                ? $booking->full_name
                : '—';
            $vehicles = $this->formatVehicles($booking);

            return [
                'id' => $booking->booking_id,
                'booking_id' => $booking->booking_id,
                'owner_user_id' => $booking->user_id,
                'resource_id' => $booking->resource_id,
                'resource_ids' => array_column($vehicles, 'resource_id'),
                'resource' => $booking->resource?->name ?? 'Unknown Resource',
                'vehicles' => $vehicles,
                'resource_names' => array_column($vehicles, 'name'),
                'full_name' => $displayName,
                'requester' => $displayName,
                'barangay' => $booking->user?->barangay ?? 'Poblacion',
                'purpose' => $booking->purpose ?? 'No purpose provided',
                'start_date' => Carbon::parse($booking->start_date)->toDateString(),
                'end_date' => Carbon::parse($booking->end_date)->toDateString(),
                'start_time' => $booking->start_time,
                'end_time' => $booking->end_time,
                'status' => $booking->status,
                'reference_id' => $booking->reference_id,
                'deleted_at' => $booking->deleted_at,
            ];
        }));
    }

    public function restore(Request $request, $id)
    {
        $user = $request->user();
        if (! $user || ! $user->isApprover()) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $booking = BookingRequest::onlyTrashed()->with(['user', 'vehicles'])->find($id);
        if (! $booking) {
            return response()->json(['message' => 'Removed booking not found.'], 404);
        }
        if ($user->isBarangayAdmin() && $booking->user?->barangay !== $user->barangay) {
            return response()->json(['message' => 'You can only restore bookings from your barangay.'], 403);
        }

        $conflicts = in_array($booking->status, ['pending', 'approved'], true)
            ? $this->conflictsForResources(
                $this->resourceIdsForBooking($booking),
                $booking->start_date,
                $booking->end_date,
                $booking->start_time,
                $booking->end_time,
                $booking->booking_id
            )
            : [];
        if ($conflicts !== []) {
            return response()->json([
                'message' => 'This booking cannot be restored because '
                    .$conflicts[0]['resource_name'].' conflicts with another active booking.',
                'unavailable_vehicles' => array_map(
                    fn ($item) => [
                        'resource_id' => $item['resource_id'],
                        'name' => $item['resource_name'],
                    ],
                    $conflicts
                ),
            ], 409);
        }

        $booking->restore();

        $resourceName = implode(', ', array_column(
            $this->formatVehicles($booking),
            'name'
        )) ?: ($booking->resource?->name ?? 'Unknown Resource');
        app(ActivityLogger::class)->record(
            $user,
            'booking.restored',
            sprintf('Restored booking #%d for %s.', $booking->booking_id, $resourceName),
            'booking',
            $booking->booking_id,
            ['status' => $booking->status]
        );

        return response()->json(['message' => 'Booking restored successfully.']);
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
        if (! $date) {
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
                    'exists:resources,resource_id',
                ],

                'item_id' => [
                    'nullable',
                    'exists:resources,resource_id',
                ],

                'resource_ids' => ['nullable', 'array', 'min:1'],
                'resource_ids.*' => ['required', 'integer', 'distinct', 'exists:resources,resource_id'],

                'full_name' => [
                    'nullable',
                    'string',
                ],

                'start_date' => [
                    'required',
                    'date',
                    'after_or_equal:'.$minimumBookingDate,
                ],

                'end_date' => [
                    'required',
                    'date',
                    'after_or_equal:start_date',
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
                    'string',
                ],

                'destination' => [
                    'nullable',
                    'string',
                ],

                'cell_number' => [
                    'nullable',
                    'string',
                ],

                'address' => [
                    'nullable',
                    'string',
                ],

                'email' => ['nullable', 'email', 'string'],

                'status' => [
                    'nullable',
                    'in:pending,approved,rejected',
                ],

                'accept_pending_conflicts' => [
                    'nullable',
                    'boolean',
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
            if (! $user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            /*
            |--------------------------------------------------------------------------
            | Determine Resource ID
            |--------------------------------------------------------------------------
            */

            $resourceIds = $validated['resource_ids'] ?? array_filter([
                $validated['resource_id'] ?? $validated['item_id'] ?? null,
            ]);
            $resourceIds = array_values(array_map('intval', $resourceIds));
            if ($resourceIds === []) {
                throw ValidationException::withMessages([
                    'resource_id' => ['A resource must be selected.'],
                ]);
            }

            $resourceId = $resourceIds[0];
            $resources = Resource::whereIn('resource_id', $resourceIds)
                ->get()
                ->keyBy('resource_id');
            if ($resources->count() !== count($resourceIds)) {
                throw ValidationException::withMessages([
                    'resource_ids' => ['One or more selected resources are unavailable.'],
                ]);
            }

            $selectedResources = collect($resourceIds)->map(
                fn ($id) => $resources->get($id)
            );
            $resource = $selectedResources->first();

            if (isset($validated['resource_ids']) && $selectedResources->contains(
                fn ($selectedResource) => strtolower($selectedResource->type) !== 'vehicle'
            )) {
                throw ValidationException::withMessages([
                    'resource_ids' => ['Only utility vehicles may be requested together.'],
                ]);
            }

            // --- Capacity Matching ---
            // If the user specified an attendee count, validate it against
            // the resource capacity (facilities only).
            if (isset($validated['attendees']) && $resourceId) {
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

            $maintenanceResources = $selectedResources
                ->filter(fn ($selectedResource) => $selectedResource->status === 'maintenance')
                ->values();
            if ($maintenanceResources->isNotEmpty()) {
                $alternatives = $this->findAvailableAlternatives(
                    $resource->type,
                    $validated['start_date'],
                    $validated['end_date'],
                    $validated['start_time'] ?? null,
                    $validated['end_time'] ?? null,
                    $resourceId
                );
                $names = $maintenanceResources->pluck('name')->all();

                return response()->json([
                    'message' => count($resourceIds) === 1
                        ? 'The selected resource is unavailable during this time.'
                        : 'Unavailable vehicles: '.implode(', ', $names).'.',
                    'conflict' => true,
                    'reason' => 'maintenance',
                    'unavailable_vehicles' => $maintenanceResources->map(fn ($item) => [
                        'resource_id' => $item->resource_id,
                        'name' => $item->name,
                    ])->all(),
                    'alternatives' => $alternatives,
                ], 409);
            }

            /*
            |--------------------------------------------------------------------------
            | Create Booking
            |--------------------------------------------------------------------------
            */

            $result = DB::transaction(function () use ($user, $validated, $resource, $resourceId, $resourceIds, $selectedResources, $resources) {
                Resource::whereIn('resource_id', $resourceIds)
                    ->orderBy('resource_id')
                    ->lockForUpdate()
                    ->get();

                $approvedConflicts = $this->conflictsForResources(
                    $resourceIds,
                    $validated['start_date'],
                    $validated['end_date'],
                    $validated['start_time'] ?? null,
                    $validated['end_time'] ?? null,
                    null,
                    ['approved']
                );
                if ($approvedConflicts !== []) {
                    return ['response' => $this->bookingConflictResponse(
                        $approvedConflicts,
                        $resourceIds,
                        $resources,
                        $validated['start_date'],
                        $validated['end_date'],
                        $validated['start_time'] ?? null,
                        $validated['end_time'] ?? null,
                        'approved'
                    )];
                }

                $pendingConflicts = $this->conflictsForResources(
                    $resourceIds,
                    $validated['start_date'],
                    $validated['end_date'],
                    $validated['start_time'] ?? null,
                    $validated['end_time'] ?? null,
                    null,
                    ['pending']
                );
                $bookingStatus = $validated['status'] ?? 'pending';
                $acceptPendingConflicts = (bool) ($validated['accept_pending_conflicts'] ?? false);
                if (
                    $pendingConflicts !== [] &&
                    ($bookingStatus !== 'pending' || ! $acceptPendingConflicts)
                ) {
                    return ['response' => $this->bookingConflictResponse(
                        $pendingConflicts,
                        $resourceIds,
                        $resources,
                        $validated['start_date'],
                        $validated['end_date'],
                        $validated['start_time'] ?? null,
                        $validated['end_time'] ?? null,
                        'pending'
                    )];
                }

                $booking = BookingRequest::create([
                    'user_id' => $user->user_id,
                    'resource_id' => $resourceId,
                    'full_name' => $validated['full_name'] ?? $user->full_name,
                    'purpose' => $validated['purpose'] ?? null,
                    'destination' => $validated['destination'] ?? null,
                    'price_per_day' => $resource?->type === 'facility'
                        ? $resource->price_per_day
                        : null,
                    'price_per_hour' => $resource?->type === 'vehicle'
                        ? $resource->price_per_hour
                        : null,
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

                if (strtolower($resource->type) === 'vehicle') {
                    $vehicleRates = $selectedResources->mapWithKeys(fn ($vehicle) => [
                        $vehicle->resource_id => ['price_per_hour' => $vehicle->price_per_hour],
                    ])->all();
                    $booking->vehicles()->sync($vehicleRates);
                }

                // Generate human-readable reference ID: JBG-YYYY-NNNN
                $referenceId = 'JBG-'.date('Y').'-'.str_pad($booking->booking_id, 4, '0', STR_PAD_LEFT);
                $booking->update(['reference_id' => $referenceId]);

                return ['booking' => $booking];
            });
            if (isset($result['response'])) {
                return $result['response'];
            }
            $booking = $result['booking'];

            // Notify administrators of new pending booking request
            $admins = User::where('role', 'admin')->get();
            $resourceName = implode(', ', $selectedResources->pluck('name')->all());
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

            app(ActivityLogger::class)->record(
                $user,
                $booking->status === 'approved' ? 'booking.allocated' : 'booking.requested',
                sprintf(
                    '%s booking #%d for %s (%s to %s).',
                    $booking->status === 'approved' ? 'Directly allocated' : 'Requested',
                    $booking->booking_id,
                    $resourceName,
                    $booking->start_date,
                    $booking->end_date
                ),
                'booking',
                $booking->booking_id,
                ['status' => $booking->status, 'resource_name' => $resourceName]
            );

            return response()->json(
                $booking->load(['resource', 'user', 'vehicles']),
                201
            );
        } catch (ValidationException $e) {
            throw $e;
        } catch (Exception $e) {
            Log::error('Failed to create booking: '.$e->getMessage());

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
            if (! $user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $validated = $request->validate([
                'status' => [
                    'required',
                    'in:approved,rejected',
                ],

                'remarks' => [
                    'nullable',
                    'string',
                ],
            ]);

            $result = DB::transaction(function () use ($booking, $validated, $user) {
                $lockedBooking = BookingRequest::where('booking_id', $booking->booking_id)
                    ->lockForUpdate()
                    ->firstOrFail();
                $lockedBooking->load('vehicles');

                if ($validated['status'] === 'approved') {
                    $bookingResourceIds = $this->resourceIdsForBooking($lockedBooking);
                    Resource::whereIn('resource_id', $bookingResourceIds)
                        ->orderBy('resource_id')
                        ->lockForUpdate()
                        ->get();

                    $conflicts = $this->conflictsForResources(
                        $bookingResourceIds,
                        Carbon::parse($lockedBooking->start_date)->toDateString(),
                        Carbon::parse($lockedBooking->end_date)->toDateString(),
                        $lockedBooking->start_time,
                        $lockedBooking->end_time,
                        $lockedBooking->booking_id,
                        ['approved']
                    );

                    if ($conflicts !== []) {
                        return [
                            'booking' => $lockedBooking,
                            'conflicts' => $conflicts,
                            'resource_ids' => $bookingResourceIds,
                        ];
                    }
                }

                $lockedBooking->update(['status' => $validated['status']]);
                Approval::create([
                    'booking_id' => $lockedBooking->booking_id,
                    'admin_id' => $user->user_id,
                    'action' => $validated['status'],
                    'remarks' => $validated['remarks'] ?? null,
                ]);

                return ['booking' => $lockedBooking, 'conflicts' => []];
            });
            $booking = $result['booking'];

            if ($result['conflicts'] !== []) {
                $conflicts = $result['conflicts'];

                return response()->json([
                    'message' => count($result['resource_ids']) === 1
                        ? 'Cannot approve this booking because the resource conflicts with an approved booking or its turnaround buffer.'
                        : 'Cannot approve this booking because selected vehicles conflict with approved bookings or their turnaround buffers.',
                    'conflict' => true,
                    'unavailable_vehicles' => array_map(
                        fn ($item) => [
                            'resource_id' => $item['resource_id'],
                            'name' => $item['resource_name'],
                        ],
                        $conflicts
                    ),
                    'conflicts' => array_map(
                        fn ($item) => [
                            'resource_name' => $item['resource_name'],
                            'status' => $item['booking']->status,
                            'start_date' => Carbon::parse($item['booking']->start_date)->toDateString(),
                            'end_date' => Carbon::parse($item['booking']->end_date)->toDateString(),
                            'start_time' => $item['booking']->start_time,
                            'end_time' => $item['booking']->end_time,
                            'buffer_minutes' => $this->bufferMinutesForResource($item['resource_id']),
                        ],
                        $conflicts
                    ),
                    'suggestions' => $this->findAvailableScheduleSuggestions(
                        $result['resource_ids'],
                        $conflicts,
                        Carbon::parse($booking->start_date)->toDateString(),
                        Carbon::parse($booking->end_date)->toDateString(),
                        $booking->start_time,
                        $booking->end_time
                    ),
                ], 422);
            }

            $booking->loadMissing('vehicles');
            $resourceName = implode(', ', array_column(
                $this->formatVehicles($booking),
                'name'
            )) ?: ($booking->resource?->name ?? 'Unknown Resource');
            Notification::create([
                'booking_id' => $booking->booking_id,
                'user_id' => $booking->user_id,
                'message' => "Your booking request for '{$resourceName}' has been {$validated['status']}.",
                'is_read' => false,
                'type' => $validated['status'] === 'approved' ? 'BOOKING_APPROVED' : 'BOOKING_REJECTED',
                'title' => $validated['status'] === 'approved' ? 'Booking Approved' : 'Booking Rejected',
            ]);

            app(ActivityLogger::class)->record(
                $user,
                'booking.'.$validated['status'],
                sprintf(
                    '%s booking #%d for %s.',
                    ucfirst($validated['status']),
                    $booking->booking_id,
                    $resourceName
                ),
                'booking',
                $booking->booking_id,
                ['status' => $validated['status'], 'resource_name' => $resourceName]
            );

            $emailNotificationSent = false;
            $emailNotificationMessage = null;
            try {
                $requester = User::find($booking->user_id);
                $recipientEmail = $booking->email;
                if (! is_string($recipientEmail) || ! filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
                    $recipientEmail = $requester?->email;
                }

                if ($requester && $recipientEmail && filter_var($recipientEmail, FILTER_VALIDATE_EMAIL)) {
                    if ($validated['status'] === 'approved') {
                        Mail::mailer('brevo')->to($recipientEmail)->send(new BookingApproved($booking, $requester));
                    } else {
                        Mail::mailer('brevo')->to($recipientEmail)->send(new BookingRejected(
                            $booking,
                            $requester,
                            $validated['remarks'] ?? null
                        ));
                    }
                    $emailNotificationSent = true;
                } else {
                    Log::warning('Skipped booking status email because the requestor has no valid email address.', [
                        'booking_id' => $booking->booking_id,
                    ]);
                    $emailNotificationMessage = 'No valid requestor email address is available.';
                }
            } catch (Exception $e) {
                Log::error('Failed to send booking status email: '.$e->getMessage(), [
                    'booking_id' => $booking->booking_id,
                ]);
                $emailNotificationMessage = 'The booking status changed, but its email notification could not be sent. Check the backend mail configuration.';
            }

            return response()->json(array_merge($booking->load(['resource', 'vehicles'])->toArray(), [
                'email_notification_sent' => $emailNotificationSent,
                'email_notification_message' => $emailNotificationMessage,
            ]));
        } catch (Exception $e) {
            Log::error('Failed to update booking status: '.$e->getMessage());

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
            if (! $user) {
                return response()->json(['message' => 'Unauthenticated.'], 401);
            }

            $booking = BookingRequest::find($id);
            if (! $booking) {
                return response()->json([
                    'message' => 'Booking already deleted or not found.',
                ], 404);
            }

            if (! $user->isAdmin()) {
                if (! $user->isBarangayAdmin()) {
                    return response()->json(['message' => 'Forbidden.'], 403);
                }

                if (! in_array($booking->status, ['pending', 'approved'], true)) {
                    return response()->json(['message' => 'Barangay admins may only remove pending or approved bookings.'], 403);
                }

                if ($booking->user?->barangay !== $user->barangay) {
                    return response()->json(['message' => 'You can only remove pending or approved bookings from your barangay.'], 403);
                }
            }

            $booking->loadMissing('vehicles');
            $resourceName = implode(', ', array_column(
                $this->formatVehicles($booking),
                'name'
            )) ?: ($booking->resource?->name ?? 'Unknown Resource');
            $bookingSummary = [
                'status' => $booking->status,
                'resource_name' => $resourceName,
                'start_date' => Carbon::parse($booking->start_date)->toDateString(),
                'end_date' => Carbon::parse($booking->end_date)->toDateString(),
            ];
            $booking->delete();

            app(ActivityLogger::class)->record(
                $user,
                'booking.deleted',
                sprintf('Deleted booking #%d for %s.', $id, $resourceName),
                'booking',
                $id,
                $bookingSummary
            );

            return response()->json([
                'message' => 'Booking deleted successfully.',
            ]);
        } catch (Exception $e) {
            Log::error('Failed to delete booking: '.$e->getMessage());

            return response()->json(['message' => 'Failed to delete booking.'], 500);
        }
    }

    /**
     * Serialize the vehicles linked to a booking while keeping the legacy
     * resource fields available to existing clients.
     */
    private function formatVehicles(BookingRequest $booking): array
    {
        $vehicles = $booking->vehicles;
        if ($vehicles->isEmpty() && strtolower((string) $booking->resource?->type) === 'vehicle') {
            $vehicles = collect([$booking->resource]);
        }

        return $vehicles
            ->sortBy(fn ($vehicle) => (int) $vehicle->resource_id === (int) $booking->resource_id ? 0 : 1)
            ->map(fn ($vehicle) => [
                'resource_id' => $vehicle->resource_id,
                'name' => $vehicle->name,
                'type' => $vehicle->type,
                'price_per_hour' => $vehicle->pivot?->price_per_hour
                    ?? ((int) $vehicle->resource_id === (int) $booking->resource_id
                        ? $booking->price_per_hour
                        : $vehicle->price_per_hour),
                'buffer_minutes' => $vehicle->buffer_minutes ?? 30,
                'image_url' => $vehicle->image
                    ? Storage::disk('assets')->url($vehicle->image)
                    : null,
            ])
            ->values()
            ->all();
    }

    private function resourceIdsForBooking(BookingRequest $booking): array
    {
        $vehicleIds = $booking->vehicles
            ->pluck('resource_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        if ($vehicleIds === []) {
            return $booking->resource_id ? [(int) $booking->resource_id] : [];
        }

        return array_values(array_unique($vehicleIds));
    }

    private function conflictsForResources(
        array $resourceIds,
        $startDate,
        $endDate,
        $startTime,
        $endTime,
        $excludeBookingId = null,
        array $statuses = ['pending', 'approved']
    ): array {
        $conflicts = [];
        foreach ($resourceIds as $resourceId) {
            $booking = $this->hasBookingConflict(
                $resourceId,
                $startDate,
                $endDate,
                $startTime,
                $endTime,
                $excludeBookingId,
                null,
                $statuses
            );
            if (! $booking) {
                continue;
            }

            $conflicts[] = [
                'resource_id' => (int) $resourceId,
                'resource_name' => Resource::withTrashed()->find($resourceId)?->name ?? 'Unknown Vehicle',
                'booking' => $booking,
            ];
        }

        return $conflicts;
    }

    private function findAvailableScheduleSuggestions(
        array $resourceIds,
        array $conflicts,
        $startDate,
        $endDate,
        $startTime,
        $endTime
    ): array {
        $candidates = [];

        foreach ($conflicts as $conflict) {
            $candidates = array_merge(
                $candidates,
                $this->findTimeSuggestions(
                    $conflict['resource_id'],
                    $startDate,
                    $endDate,
                    $startTime,
                    $endTime,
                    $conflict['booking']
                )
            );
        }

        $suggestions = [];
        foreach ($candidates as $candidate) {
            $candidateStart = Carbon::parse($candidate['start_time']);
            $candidateEnd = Carbon::parse($candidate['end_time']);
            $candidateStartTime = $startTime ? $candidateStart->format('H:i:s') : null;
            $candidateEndTime = $endTime ? $candidateEnd->format('H:i:s') : null;

            $availableForEveryResource = true;
            foreach ($resourceIds as $resourceId) {
                if ($this->hasBookingConflict(
                    $resourceId,
                    $candidateStart->toDateString(),
                    $candidateEnd->toDateString(),
                    $candidateStartTime,
                    $candidateEndTime,
                    null,
                    null,
                    ['approved']
                )) {
                    $availableForEveryResource = false;
                    break;
                }
            }

            if ($availableForEveryResource) {
                $suggestions[] = $candidate;
            }
        }

        usort(
            $suggestions,
            fn ($a, $b) => strcmp($a['start_time'], $b['start_time'])
        );

        $uniqueSuggestions = [];
        foreach ($suggestions as $suggestion) {
            $key = $suggestion['start_time'].'|'.$suggestion['end_time'];
            $uniqueSuggestions[$key] = $suggestion;
        }

        return array_slice(array_values($uniqueSuggestions), 0, 3);
    }

    private function bookingConflictResponse(
        array $conflicts,
        array $resourceIds,
        $resources,
        $startDate,
        $endDate,
        $startTime,
        $endTime,
        string $conflictType
    ) {
        $firstConflict = $conflicts[0];
        $booking = $firstConflict['booking'];
        $resource = $resources->get($firstConflict['resource_id']);
        $alternatives = [];
        $suggestions = [];

        if ($resource) {
            $alternatives = $this->findAvailableAlternatives(
                $resource->type,
                $startDate,
                $endDate,
                $startTime,
                $endTime,
                $resource->resource_id
            );
            $suggestions = $this->findTimeSuggestions(
                $resource->resource_id,
                $startDate,
                $endDate,
                $startTime,
                $endTime,
                $booking
            );
        }

        $pendingConflict = $conflictType === 'pending';

        return response()->json([
            'message' => $pendingConflict
                ? (count($resourceIds) === 1
                    ? 'A pending request overlaps this time slot. Review it before continuing.'
                    : 'Pending requests overlap these selected vehicles: '.implode(', ', array_column($conflicts, 'resource_name')).'.')
                : (count($resourceIds) === 1
                    ? 'The requested time slot conflicts with an existing reservation.'
                    : 'Unavailable vehicles: '.implode(', ', array_column($conflicts, 'resource_name')).'.'),
            'conflict' => true,
            'conflict_type' => $conflictType,
            'pending_conflicts_required' => $pendingConflict,
            'unavailable_vehicles' => array_map(
                fn ($item) => [
                    'resource_id' => $item['resource_id'],
                    'name' => $item['resource_name'],
                    'status' => $item['booking']->status,
                ],
                $conflicts
            ),
            'pending_conflicts' => $pendingConflict
                ? array_map(
                    fn ($item) => [
                        'resource_id' => $item['resource_id'],
                        'name' => $item['resource_name'],
                        'start_date' => $item['booking']->start_date,
                        'end_date' => $item['booking']->end_date,
                        'start_time' => $item['booking']->start_time,
                        'end_time' => $item['booking']->end_time,
                    ],
                    $conflicts
                )
                : [],
            'conflicting_booking' => [
                'start_date' => $booking->start_date,
                'end_date' => $booking->end_date,
                'start_time' => $booking->start_time,
                'end_time' => $booking->end_time,
                'full_name' => $booking->full_name,
                'purpose' => $booking->purpose,
                'status' => $booking->status,
            ],
            'alternatives' => $alternatives,
            'suggestions' => $suggestions,
        ], 409);
    }

    private function bookingsForResource($resourceId)
    {
        return BookingRequest::where(function ($query) use ($resourceId) {
            $query->where('resource_id', $resourceId)
                ->orWhereHas('vehicles', fn ($vehicles) => $vehicles
                    ->where('resources.resource_id', $resourceId));
        });
    }

    /**
     * Check pending and approved bookings using datetime interval overlap.
     * Existing reservations block the resource for its configured buffer
     * before and after their scheduled interval.
     *
     * @param  int  $resourceId
     * @param  string  $startDate  (Y-m-d)
     * @param  string  $endDate  (Y-m-d)
     * @param  string|null  $startTime  (HH:MM or HH:MM:SS)
     * @param  string|null  $endTime  (HH:MM or HH:MM:SS)
     * @param  int|null  $excludeBookingId  Booking ID to exclude (self on update)
     * @return BookingRequest|null Returns the conflicting booking or null
     */
    private function hasBookingConflict(
        $resourceId,
        $startDate,
        $endDate,
        $startTime,
        $endTime,
        $excludeBookingId = null,
        $bufferMinutes = null,
        array $statuses = ['pending', 'approved']
    ) {
        if (! $resourceId) {
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

        $candidates = $this->bookingsForResource($resourceId)
            ->whereIn('status', $statuses)
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

        if (! $startTime || ! $endTime) {
            return [$startDay, $endDay->endOfDay()];
        }

        return [
            Carbon::parse($startDate.' '.$startTime),
            Carbon::parse($endDate.' '.$endTime),
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

            if (! $nextConflict) {
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

        $lastBookedDate = $this->bookingsForResource($resourceId)
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

            if (! $this->hasBookingConflict(
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
     * @param  string  $resourceType  'vehicle' or 'facility'
     * @param  string  $startDate
     * @param  string  $endDate
     * @param  string|null  $startTime
     * @param  string|null  $endTime
     * @param  int  $excludeResourceId  Resource ID to exclude from results
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

            if (! $conflict) {
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
        if (! $time) {
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
        if (! $resourceId) {
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
        $bookings = $this->bookingsForResource($resourceId)
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
