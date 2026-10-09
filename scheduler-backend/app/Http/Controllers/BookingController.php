<?php

namespace App\Http\Controllers;

use App\Models\Approval;
use App\Models\BookingRequest;
use App\Models\Notification;
use App\Models\Resource;
use Illuminate\Http\Request;
use Carbon\Carbon;

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
        $query = BookingRequest::with([
            'resource',
            'user'
        ]);

        $bookings = $query
            ->latest('booking_id')
            ->get();

        $formatted = $bookings->map(function ($b) {

            return [
                /*
                |--------------------------------------------------------------------------
                | Basic Information
                |--------------------------------------------------------------------------
                */

                'id' => $b->booking_id,

                'resource_id' => $b->resource_id,

                'resource' =>
                    $b->resource->name ??
                    'Unknown Resource',


                /*
                |--------------------------------------------------------------------------
                | Requestor Information
                |--------------------------------------------------------------------------
                */

                'full_name' =>
                    $b->full_name &&
                    $b->full_name !== ($b->user->name ?? null)
                        ? $b->full_name
                        : '—',

                'requester' =>
                    $b->full_name &&
                    $b->full_name !== ($b->user->name ?? null)
                        ? $b->full_name
                        : '—',

                'barangay' =>
                    $b->user->barangay ??
                    $b->user->name ??
                    'Poblacion',

                'cell_number' =>
                    $b->cell_number ??
                    'N/A',

                'where_do_you_live' =>
                    $b->address ??
                    'N/A',

                'address' =>
                    $b->address ??
                    'N/A',


                /*
                |--------------------------------------------------------------------------
                | Booking Information
                |--------------------------------------------------------------------------
                */

                'purpose' =>
                    $b->purpose ??
                    'No purpose provided',


                /*
                |--------------------------------------------------------------------------
                | IMPORTANT:
                | Separate start and end dates.
                |
                | These are needed for:
                | - Specific Date filtering
                | - Monthly filtering
                | - Yearly filtering
                | - Multi-day bookings
                |--------------------------------------------------------------------------
                */

                'start_date' =>
                    Carbon::parse(
                        $b->start_date
                    )->toDateString(),

                'end_date' =>
                    Carbon::parse(
                        $b->end_date
                    )->toDateString(),


                /*
                |--------------------------------------------------------------------------
                | Keep combined date for existing frontend components
                |--------------------------------------------------------------------------
                */

                'date' =>
                    Carbon::parse(
                        $b->start_date
                    )->toDateString()
                    . ' to ' .
                    Carbon::parse(
                        $b->end_date
                    )->toDateString(),


                /*
                |--------------------------------------------------------------------------
                | Time
                |--------------------------------------------------------------------------
                */

                'start_time' =>
                    $b->start_time,

                'end_time' =>
                    $b->end_time,

                'time' =>
                    ($b->start_time && $b->end_time)
                        ? "{$b->start_time} - {$b->end_time}"
                        : 'All Day',


                /*
                |--------------------------------------------------------------------------
                | Status
                |--------------------------------------------------------------------------
                */

                'status' =>
                    $b->status,

                'is_special_event' =>
                    $b->is_special_event ?? false,
            ];
        });

        return response()->json($formatted);
    }


    /*
    |--------------------------------------------------------------------------
    | Create Booking
    |--------------------------------------------------------------------------
    */

    public function store(Request $request)
    {
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
        ]);


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
            return response()->json([
                'message' => 'This resource is already booked (approved) for the selected date and time. Please choose a different date or time.',
            ], 422);
        }


        /*
        |--------------------------------------------------------------------------
        | Create Booking
        |--------------------------------------------------------------------------
        */

        $booking = BookingRequest::create([

            'user_id' =>
                $request->user()->user_id,

            'resource_id' =>
                $resourceId,

            'full_name' =>
                $validated['full_name']
                ?? $request->user()->full_name,

            'purpose' =>
                $validated['purpose'] ?? null,

            'start_date' =>
                $validated['start_date'],

            'end_date' =>
                $validated['end_date'],

            'start_time' =>
                $validated['start_time'] ?? null,

            'end_time' =>
                $validated['end_time'] ?? null,

            'cell_number' =>
                $validated['cell_number'] ?? null,

            'address' =>
                $validated['address'] ?? null,

            'status' =>
                'pending',
        ]);


        return response()->json(
            $booking->load([
                'resource',
                'user'
            ]),
            201
        );
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


        /*
        |--------------------------------------------------------------------------
        | Update Booking Status
        |--------------------------------------------------------------------------
        */

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
            'status' =>
                $validated['status']
        ]);


        /*
        |--------------------------------------------------------------------------
        | Save Approval Record
        |--------------------------------------------------------------------------
        */

        Approval::create([
            'booking_id' =>
                $booking->booking_id,

            'admin_id' =>
                $request->user()->user_id,

            'action' =>
                $validated['status'],

            'remarks' =>
                $validated['remarks'] ?? null,
        ]);


        /*
        |--------------------------------------------------------------------------
        | Create Notification
        |--------------------------------------------------------------------------
        */

        Notification::create([
            'booking_id' =>
                $booking->booking_id,

            'user_id' =>
                $booking->user_id,

            'message' =>
                "Your booking request has been {$validated['status']}.",

            'is_read' =>
                false,
        ]);


        return response()->json($booking);
    }


    /*
    |--------------------------------------------------------------------------
    | Delete Booking
    |--------------------------------------------------------------------------
    */

    public function destroy(BookingRequest $booking)
    {
        $booking->delete();

        return response()->json([
            'message' =>
                'Booking deleted successfully.'
        ]);
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
}
