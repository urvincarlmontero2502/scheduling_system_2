<?php

namespace App\Services;

use App\Models\BookingRequest;
use Carbon\Carbon;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

class ResourceReportService
{
    public function build(
        Collection $bookings,
        ?int $resourceId,
        string $resourceType,
        array $period
    ): array {
        $rows = $bookings
            ->map(fn (BookingRequest $booking) => $this->formatBooking($booking, $resourceId, $resourceType))
            ->filter(fn (?array $row) => $row !== null)
            ->values();

        $summary = $this->summarize($rows);
        $breakdownType = $this->breakdownType($period['period'], $period['start_date'], $period['end_date']);

        return [
            'meta' => [
                'resource' => $period['resource'],
                'period' => $period['period'],
                'period_label' => $period['period_label'],
                'start_date' => $period['start_date'],
                'end_date' => $period['end_date'],
                'generated_at' => CarbonImmutable::now('Asia/Manila')->toIso8601String(),
                'grouping' => $breakdownType,
                'booking_period_basis' => 'Bookings are grouped by their start date.',
                'financial_label' => 'Estimated/Assessed Amount',
                'payment_tracking_available' => false,
            ],
            'summary' => $summary,
            'breakdown' => $this->buildBreakdown(
                $rows,
                $breakdownType,
                $period['start_date'],
                $period['end_date'],
            ),
            'bookings' => $rows->all(),
        ];
    }

    private function formatBooking(
        BookingRequest $booking,
        ?int $resourceId,
        string $resourceType
    ): ?array {
        $resources = $booking->vehicles->isNotEmpty()
            ? $booking->vehicles
            : collect([$booking->resource])->filter();

        $assignments = $resources
            ->filter(function ($resource) use ($resourceId, $resourceType) {
                if ($resourceId !== null && (int) $resource->resource_id !== $resourceId) {
                    return false;
                }

                return $resourceType === 'all'
                    || strtolower((string) $resource->type) === $resourceType;
            })
            ->map(fn ($resource) => $this->formatAssignment($booking, $resource))
            ->values();

        if ($assignments->isEmpty()) {
            return null;
        }

        $status = $this->statusGroup($booking);
        $isRevenueEligible = in_array($status, ['approved', 'completed'], true);
        $knownAmount = round((float) $assignments->sum(
            fn (array $assignment) => $assignment['amount'] ?? 0
        ), 2);
        $unassessedAssignments = $isRevenueEligible
            ? $assignments->whereNull('amount')->count()
            : 0;
        $amountStatus = match (true) {
            ! $isRevenueEligible => 'not_included',
            $unassessedAssignments > 0 && $knownAmount > 0 => 'partial',
            $unassessedAssignments > 0 => 'for_assessment',
            default => 'assessed',
        };
        $estimatedAmount = $isRevenueEligible
            ? ($unassessedAssignments > 0 && $knownAmount === 0.0 ? null : $knownAmount)
            : null;

        return [
            'booking_id' => $booking->booking_id,
            'booking_number' => $booking->reference_id ?: '#'.$booking->booking_id,
            'requester' => $booking->full_name ?: ($booking->user?->full_name ?: '—'),
            'start_date' => CarbonImmutable::parse($booking->start_date)->toDateString(),
            'end_date' => CarbonImmutable::parse($booking->end_date ?? $booking->start_date)->toDateString(),
            'start_time' => $booking->start_time,
            'end_time' => $booking->end_time,
            'purpose' => $booking->purpose ?: '—',
            'status' => $status,
            'status_label' => $this->statusLabel($status, $booking->status),
            'resource_assignments' => $assignments->all(),
            'resource_names' => $assignments->pluck('name')->all(),
            'estimated_amount' => $estimatedAmount,
            'amount_status' => $amountStatus,
            'amount_is_complete' => $isRevenueEligible && $unassessedAssignments === 0,
            'unassessed_assignments' => $unassessedAssignments,
            'usage_days' => $isRevenueEligible ? (int) $assignments->sum('usage_days') : 0,
            'usage_hours' => $isRevenueEligible && $assignments->contains(
                fn (array $assignment) => $assignment['usage_hours'] !== null
            )
                ? round((float) $assignments->sum(fn (array $assignment) => $assignment['usage_hours'] ?? 0), 2)
                : null,
            'booking_date' => CarbonImmutable::parse($booking->start_date)->toDateString(),
        ];
    }

    private function formatAssignment(BookingRequest $booking, $resource): array
    {
        $type = strtolower((string) $resource->type);
        $startDate = CarbonImmutable::parse($booking->start_date)->startOfDay();
        $endDate = CarbonImmutable::parse($booking->end_date ?? $booking->start_date)->startOfDay();
        $days = $endDate->lt($startDate) ? 0 : (int) $startDate->diffInDays($endDate) + 1;
        $durationMinutes = $this->durationMinutes($booking, $startDate, $endDate);
        $usageMinutes = $booking->start_time && $booking->end_time
            ? $durationMinutes
            : null;

        if ($type === 'vehicle') {
            $rate = $booking->vehicles->isNotEmpty()
                ? ($resource->pivot?->price_per_hour
                    ?? ((int) $resource->resource_id === (int) $booking->resource_id
                        ? $booking->price_per_hour
                        : $resource->price_per_hour))
                : ($booking->price_per_hour ?? $resource->price_per_hour);
            $billableUnits = (int) ceil($durationMinutes / 60);
            $rateUnit = 'hour';
        } else {
            $rate = $booking->price_per_day ?? $resource->price_per_day;
            $billableUnits = $days;
            $rateUnit = 'day';
        }

        $rate = is_numeric($rate) && (float) $rate >= 0 ? (float) $rate : null;
        $isRevenueEligible = in_array($this->statusGroup($booking), ['approved', 'completed'], true);

        return [
            'resource_id' => $resource->resource_id,
            'name' => $resource->name ?: 'Unknown Resource',
            'type' => $type,
            'rate' => $rate,
            'rate_unit' => $rateUnit,
            'billable_units' => $billableUnits,
            'billable_unit_label' => $rateUnit.($billableUnits === 1 ? '' : 's'),
            'amount' => $isRevenueEligible && $rate !== null && $billableUnits > 0
                ? round($rate * $billableUnits, 2)
                : null,
            'usage_days' => $days,
            'usage_hours' => $usageMinutes === null ? null : round($usageMinutes / 60, 2),
        ];
    }

    private function durationMinutes(BookingRequest $booking, CarbonImmutable $startDate, CarbonImmutable $endDate): int
    {
        $startAt = CarbonImmutable::parse(
            $startDate->toDateString().' '.($booking->start_time ?: '00:00'),
            'Asia/Manila',
        );
        $endAt = $booking->end_time
            ? CarbonImmutable::parse($endDate->toDateString().' '.$booking->end_time, 'Asia/Manila')
            : $endDate->addDay()->startOfDay();

        return max(0, (int) floor(($endAt->getTimestamp() - $startAt->getTimestamp()) / 60));
    }

    private function statusGroup(BookingRequest $booking): string
    {
        $status = strtolower(trim((string) $booking->status));
        if ($booking->deleted_at || in_array($status, ['cancelled', 'canceled', 'removed'], true)) {
            return 'cancelled';
        }

        return match ($status) {
            'approved' => 'approved',
            'completed' => 'completed',
            'pending' => 'pending',
            'rejected' => 'rejected',
            default => 'other',
        };
    }

    private function statusLabel(string $status, ?string $rawStatus): string
    {
        if ($status === 'cancelled') {
            return 'Cancelled/Removed';
        }
        if ($status === 'other') {
            return ucfirst($rawStatus ?: 'Unknown');
        }

        return ucfirst($status);
    }

    private function summarize(Collection $rows): array
    {
        $counts = [
            'approved_bookings' => $rows->where('status', 'approved')->count(),
            'completed_bookings' => $rows->where('status', 'completed')->count(),
            'pending_bookings' => $rows->where('status', 'pending')->count(),
            'rejected_bookings' => $rows->where('status', 'rejected')->count(),
            'cancelled_bookings' => $rows->where('status', 'cancelled')->count(),
        ];
        $successfulRows = $rows->filter(fn (array $row) => in_array($row['status'], ['approved', 'completed'], true));
        $successfulAssignments = $successfulRows->sum(fn (array $row) => count($row['resource_assignments']));
        $timedAssignments = $successfulRows->sum(
            fn (array $row) => collect($row['resource_assignments'])
                ->whereNotNull('usage_hours')
                ->count()
        );
        $usageDays = (int) $successfulRows->sum('usage_days');
        $usageHours = round((float) $successfulRows->sum(
            fn (array $row) => $row['usage_hours'] ?? 0
        ), 2);
        $unassessedAssignments = (int) $successfulRows->sum('unassessed_assignments');
        $amount = round((float) $successfulRows->sum(
            fn (array $row) => $row['estimated_amount'] ?? 0
        ), 2);
        $purposes = $rows
            ->map(fn (array $row) => trim((string) $row['purpose']))
            ->filter(fn (string $purpose) => $purpose !== '' && $purpose !== '—')
            ->countBy()
            ->sortDesc();

        return [
            'total_bookings' => $rows->count(),
            'resource_assignments' => $rows->sum(fn (array $row) => count($row['resource_assignments'])),
            ...$counts,
            'other_bookings' => $rows->where('status', 'other')->count(),
            'approved_resource_assignments' => $successfulAssignments,
            'total_usage_days' => $usageDays,
            'total_usage_hours' => $timedAssignments > 0 ? $usageHours : null,
            'timed_usage_assignments' => $timedAssignments,
            'average_duration_days' => $successfulAssignments > 0
                ? round($usageDays / $successfulAssignments, 2)
                : null,
            'average_duration_hours' => $successfulAssignments > 0
                ? ($timedAssignments > 0 ? round($usageHours / $timedAssignments, 2) : null)
                : null,
            'estimated_assessed_amount' => $amount,
            'amount_is_complete' => $unassessedAssignments === 0,
            'unassessed_successful_assignments' => $unassessedAssignments,
            'most_common_purpose' => $purposes->isEmpty()
                ? null
                : ['purpose' => $purposes->keys()->first(), 'count' => $purposes->first()],
            'amount_paid' => null,
            'outstanding_balance' => null,
        ];
    }

    private function breakdownType(string $period, string $startDate, string $endDate): string
    {
        if ($period === 'week') {
            return 'day';
        }
        if ($period === 'month') {
            return 'week';
        }
        if ($period === 'year') {
            return 'month';
        }

        $days = (int) CarbonImmutable::parse($startDate)->diffInDays(CarbonImmutable::parse($endDate)) + 1;

        return $days <= 14 ? 'day' : ($days <= 90 ? 'week' : 'month');
    }

    private function buildBreakdown(
        Collection $rows,
        string $grouping,
        string $startDate,
        string $endDate
    ): array {
        $start = CarbonImmutable::parse($startDate, 'Asia/Manila')->startOfDay();
        $end = CarbonImmutable::parse($endDate, 'Asia/Manila')->startOfDay();
        $cursor = match ($grouping) {
            'week' => $start->startOfWeek(Carbon::MONDAY),
            'month' => $start->startOfMonth(),
            default => $start,
        };
        $buckets = [];

        while ($cursor->lte($end)) {
            $bucketStart = $cursor->lt($start) ? $start : $cursor;
            $rawBucketEnd = match ($grouping) {
                'week' => $cursor->addDays(6),
                'month' => $cursor->endOfMonth(),
                default => $cursor,
            };
            $bucketEnd = $rawBucketEnd->gt($end) ? $end : $rawBucketEnd;
            $key = match ($grouping) {
                'week' => $cursor->startOfWeek(Carbon::MONDAY)->toDateString(),
                'month' => $cursor->format('Y-m'),
                default => $cursor->toDateString(),
            };
            $label = match ($grouping) {
                'week' => $bucketStart->format('M j').'–'.$bucketEnd->format('M j'),
                'month' => $cursor->format('F Y'),
                default => $cursor->format('M j'),
            };
            $buckets[$key] = [
                'key' => $key,
                'label' => $label,
                'start_date' => $bucketStart->toDateString(),
                'end_date' => $bucketEnd->toDateString(),
                'total_bookings' => 0,
                'resource_assignments' => 0,
                'approved_bookings' => 0,
                'completed_bookings' => 0,
                'pending_bookings' => 0,
                'rejected_bookings' => 0,
                'cancelled_bookings' => 0,
                'estimated_assessed_amount' => 0.0,
                'amount_is_complete' => true,
                'unassessed_successful_assignments' => 0,
                'usage_days' => 0,
                'usage_hours' => 0.0,
                'timed_usage_assignments' => 0,
            ];
            $cursor = match ($grouping) {
                'week' => $cursor->addWeek(),
                'month' => $cursor->addMonth(),
                default => $cursor->addDay(),
            };
        }

        foreach ($rows as $row) {
            $bookingDate = CarbonImmutable::parse($row['booking_date'], 'Asia/Manila');
            $key = match ($grouping) {
                'week' => $bookingDate->startOfWeek(Carbon::MONDAY)->toDateString(),
                'month' => $bookingDate->format('Y-m'),
                default => $bookingDate->toDateString(),
            };
            if (! isset($buckets[$key])) {
                continue;
            }

            $bucket = &$buckets[$key];
            $bucket['total_bookings']++;
            $bucket['resource_assignments'] += count($row['resource_assignments']);
            if (isset($bucket[$row['status'].'_bookings'])) {
                $bucket[$row['status'].'_bookings']++;
            }
            if (in_array($row['status'], ['approved', 'completed'], true)) {
                $bucket['usage_days'] += $row['usage_days'];
                if ($row['usage_hours'] !== null) {
                    $bucket['usage_hours'] += $row['usage_hours'];
                    $bucket['timed_usage_assignments'] += collect($row['resource_assignments'])
                        ->whereNotNull('usage_hours')
                        ->count();
                }
                $bucket['estimated_assessed_amount'] += $row['estimated_amount'] ?? 0;
                $bucket['unassessed_successful_assignments'] += $row['unassessed_assignments'];
                $bucket['amount_is_complete'] = $bucket['amount_is_complete'] && $row['amount_is_complete'];
            }
            unset($bucket);
        }

        foreach ($buckets as &$bucket) {
            $bucket['estimated_assessed_amount'] = round($bucket['estimated_assessed_amount'], 2);
            $bucket['usage_hours'] = $bucket['timed_usage_assignments'] > 0
                ? round($bucket['usage_hours'], 2)
                : null;
        }
        unset($bucket);

        return array_values($buckets);
    }
}
