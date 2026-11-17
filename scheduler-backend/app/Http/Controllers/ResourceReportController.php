<?php

namespace App\Http\Controllers;

use App\Models\BookingRequest;
use App\Models\Resource;
use App\Services\ResourceReportService;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ResourceReportController extends Controller
{
    public function index(Request $request, ResourceReportService $reportService)
    {
        $user = $request->user();
        if (! $user || ! in_array($user->role, ['admin', 'barangay_admin', 'staff'], true)) {
            return response()->json(['message' => 'You are not authorized to view reports.'], 403);
        }

        $validated = $request->validate([
            'resource_id' => ['nullable', 'integer', 'exists:resources,resource_id'],
            'resource_type' => ['nullable', Rule::in(['all', 'facility', 'vehicle'])],
            'period' => ['required', Rule::in(['week', 'month', 'year', 'custom'])],
            'start_date' => ['required_if:period,custom', 'nullable', 'date_format:Y-m-d'],
            'end_date' => ['required_if:period,custom', 'nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
        ]);

        $resourceType = $validated['resource_type'] ?? 'all';
        $resource = isset($validated['resource_id'])
            ? Resource::withTrashed()->findOrFail($validated['resource_id'])
            : null;
        if ($resource) {
            if ($resourceType !== 'all' && $resourceType !== $resource->type) {
                return response()->json([
                    'message' => 'The selected resource does not match the resource type filter.',
                    'errors' => ['resource_type' => ['Choose a matching resource type.']],
                ], 422);
            }
            $resourceType = $resource->type;
        }

        $dateRange = $this->resolveDateRange($validated);
        $query = BookingRequest::withTrashed()
            ->with(['resource', 'user', 'vehicles'])
            ->whereBetween('start_date', [$dateRange['start_date'], $dateRange['end_date']]);

        if ($user->isBarangayAdmin()) {
            $query->where(function ($builder) use ($user) {
                $builder->where('is_special_event', true)
                    ->orWhereHas('user', fn ($userQuery) => $userQuery->where('barangay', $user->barangay));
            });
        } elseif ($user->role !== 'admin') {
            $query->where('user_id', $user->user_id);
        }

        $resourceId = $resource?->resource_id;
        if ($resourceId !== null) {
            $query->where(function ($builder) use ($resourceId) {
                $builder->where('resource_id', $resourceId)
                    ->orWhereHas('vehicles', fn ($vehicles) => $vehicles->where('resources.resource_id', $resourceId));
            });
        } elseif ($resourceType === 'facility') {
            $query->whereHas('resource', fn ($resources) => $resources->where('resources.type', 'facility'));
        } elseif ($resourceType === 'vehicle') {
            $query->where(function ($builder) {
                $builder->whereHas('vehicles', fn ($vehicles) => $vehicles->where('resources.type', 'vehicle'))
                    ->orWhereHas('resource', fn ($resources) => $resources->where('resources.type', 'vehicle'));
            });
        }

        $bookings = $query
            ->orderBy('start_date')
            ->orderBy('booking_id')
            ->get();

        $resourceFilter = [
            'id' => $resource?->resource_id,
            'name' => $resource?->name ?? match ($resourceType) {
                'facility' => 'All Facilities',
                'vehicle' => 'All Utility Vehicles',
                default => 'All Resources',
            },
            'type' => $resource?->type ?? $resourceType,
        ];

        return response()->json($reportService->build(
            $bookings,
            $resourceId === null ? null : (int) $resourceId,
            $resourceType,
            [
                ...$dateRange,
                'period' => $validated['period'],
                'period_label' => $this->periodLabel($validated['period'], $dateRange),
                'resource' => $resourceFilter,
            ],
        ));
    }

    private function resolveDateRange(array $validated): array
    {
        $today = CarbonImmutable::now('Asia/Manila')->startOfDay();
        $period = $validated['period'];

        if ($period === 'custom') {
            $start = CarbonImmutable::createFromFormat('!Y-m-d', $validated['start_date'], 'Asia/Manila');
            $end = CarbonImmutable::createFromFormat('!Y-m-d', $validated['end_date'], 'Asia/Manila');
        } else {
            [$start, $end] = match ($period) {
                'week' => [
                    $today->startOfWeek(Carbon::MONDAY),
                    $today->startOfWeek(Carbon::MONDAY)->addDays(6),
                ],
                'month' => [$today->startOfMonth(), $today->endOfMonth()],
                'year' => [$today->startOfYear(), $today->endOfYear()],
            };
        }

        return [
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
        ];
    }

    private function periodLabel(string $period, array $dateRange): string
    {
        $start = CarbonImmutable::parse($dateRange['start_date'], 'Asia/Manila');
        $end = CarbonImmutable::parse($dateRange['end_date'], 'Asia/Manila');

        return match ($period) {
            'week' => 'This Week',
            'month' => 'This Month',
            'year' => 'This Year',
            default => $start->format('M j, Y').' – '.$end->format('M j, Y'),
        };
    }
}
