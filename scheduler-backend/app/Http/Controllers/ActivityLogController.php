<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isAdmin() || $user->isBarangayAdmin(), 403);

        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'action' => ['nullable', 'string', 'max:80'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = ActivityLog::query()
            ->where('created_at', '>=', now()->subYear())
            ->when(
                $validated['action'] ?? null,
                fn ($query, $action) => $query->where('action', $action)
            )
            ->when($validated['search'] ?? null, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('actor_name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('subject_id', 'like', "%{$search}%");
                });
            });

        if ($user->isBarangayAdmin()) {
            abort_unless(is_string($user->barangay) && $user->barangay !== '', 403);
            $barangay = $user->barangay;
            $userIds = DB::table('users')
                ->where('barangay', $barangay)
                ->pluck('user_id');
            $userSubjectIds = $userIds
                ->map(fn ($id) => (string) $id)
                ->all();
            $bookingIds = DB::table('booking_request')
                ->whereIn('user_id', $userIds)
                ->pluck('booking_id')
                ->all();
            $bookingSubjectIds = array_map('strval', $bookingIds);
            $removalRequestIds = $bookingIds === []
                ? []
                : DB::table('booking_removal_requests')
                    ->whereIn('booking_id', $bookingIds)
                    ->pluck('removal_request_id')
                    ->map(fn ($id) => (string) $id)
                    ->all();
            $registrationIds = DB::table('registration_requests')
                ->where('barangay', $barangay)
                ->pluck('request_id')
                ->map(fn ($id) => (string) $id)
                ->all();

            $query->where(function ($scope) use (
                $barangay,
                $userSubjectIds,
                $bookingSubjectIds,
                $removalRequestIds,
                $registrationIds
            ) {
                $scope->where(function ($userLogs) use ($barangay, $userSubjectIds) {
                    $userLogs->where('subject_type', 'user')
                        ->where(function ($subjects) use ($barangay, $userSubjectIds) {
                            $subjects->whereIn('subject_id', $userSubjectIds)
                                ->orWhere('properties->barangay', $barangay)
                                ->orWhere('properties->old_barangay', $barangay)
                                ->orWhere('properties->new_barangay', $barangay);
                        });
                });

                if ($bookingSubjectIds !== []) {
                    $scope->orWhere(fn ($bookingLogs) => $bookingLogs
                        ->where('subject_type', 'booking')
                        ->whereIn('subject_id', $bookingSubjectIds));
                }

                if ($removalRequestIds !== []) {
                    $scope->orWhere(fn ($removalLogs) => $removalLogs
                        ->where('subject_type', 'booking_removal_request')
                        ->whereIn('subject_id', $removalRequestIds));
                }

                if ($registrationIds !== []) {
                    $scope->orWhere(fn ($registrationLogs) => $registrationLogs
                        ->where('subject_type', 'registration')
                        ->whereIn('subject_id', $registrationIds));
                }
            });
        }

        return response()->json(
            $query->orderByDesc('created_at')
                ->orderByDesc('activity_log_id')
                ->paginate(25)
        );
    }
}
