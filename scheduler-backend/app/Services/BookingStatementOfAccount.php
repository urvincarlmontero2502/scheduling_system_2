<?php

namespace App\Services;

use App\Models\BookingRequest;
use Carbon\Carbon;

class BookingStatementOfAccount
{
    public function build(BookingRequest $booking): array
    {
        $booking->loadMissing(['resource', 'user']);

        $startDate = Carbon::parse($booking->start_date)->startOfDay();
        $endDate = Carbon::parse($booking->end_date ?? $booking->start_date)->startOfDay();
        $resource = $booking->resource;
        $isVehicle = strtolower((string) $resource?->type) === 'vehicle';
        $resourceType = $isVehicle ? 'Vehicle' : 'Facility';

        if ($isVehicle) {
            $startAt = Carbon::parse(
                $startDate->toDateString().' '.($booking->start_time ?: '00:00')
            );
            $endAt = $booking->end_time
                ? Carbon::parse($endDate->toDateString().' '.$booking->end_time)
                : $endDate->copy()->addDay()->startOfDay();
            $durationMinutes = max(0, (int) floor(($endAt->getTimestamp() - $startAt->getTimestamp()) / 60));
            $quantity = (int) ceil($durationMinutes / 60);
            $rate = $this->validRate($booking->price_per_hour ?? $resource?->price_per_hour);
            $chargeTitle = 'Vehicle rental';
            $quantityLabel = "{$quantity} billable hour".($quantity === 1 ? '' : 's');
            $rateLabel = 'Hourly rate';
            $durationLabel = sprintf(
                '%dh%s',
                intdiv($durationMinutes, 60),
                $durationMinutes % 60 ? ' '.($durationMinutes % 60).'m' : ''
            );
        } else {
            $quantity = $endDate >= $startDate
                ? (int) $startDate->diffInDays($endDate) + 1
                : 0;
            $rate = $this->validRate($booking->price_per_day ?? $resource?->price_per_day);
            $chargeTitle = 'Facility use';
            $quantityLabel = "{$quantity} booked day".($quantity === 1 ? '' : 's');
            $rateLabel = 'Daily rate';
            $durationLabel = null;
        }

        $amount = $rate !== null && $quantity > 0
            ? round($rate * $quantity, 2)
            : null;
        $referenceNumber = $booking->reference_id ?: '#'.$booking->booking_id;
        $safeReference = preg_replace('/[^A-Za-z0-9._-]/', '-', $referenceNumber);

        return [
            'reference_number' => $referenceNumber,
            'booking_id' => $booking->booking_id,
            'client_name' => $booking->full_name ?: ($booking->user?->full_name ?: 'Requestor'),
            'barangay' => $booking->user?->barangay ?: '—',
            'contact_number' => $booking->cell_number ?: '—',
            'email' => $booking->email ?: ($booking->user?->email ?: '—'),
            'address' => $booking->address ?: '—',
            'resource_name' => $resource?->name ?? 'Unknown Resource',
            'resource_type' => $resourceType,
            'start_date' => $startDate->format('M d, Y'),
            'end_date' => $endDate->format('M d, Y'),
            'time' => $this->formatTimeRange($booking->start_time, $booking->end_time),
            'purpose' => $booking->purpose ?: 'Not specified',
            'destination' => $booking->destination,
            'attendees' => $booking->attendees,
            'charge_title' => $chargeTitle,
            'quantity_label' => $quantityLabel,
            'rate_label' => $rateLabel,
            'rate' => $rate,
            'amount' => $amount,
            'amount_formatted' => $amount === null ? null : '₱'.number_format($amount, 2),
            'duration' => $durationLabel,
            'generated_at' => now()->format('M d, Y'),
            'file_name' => "SOA-{$safeReference}.pdf",
        ];
    }

    private function validRate(mixed $rate): ?float
    {
        return is_numeric($rate) && (float) $rate >= 0
            ? (float) $rate
            : null;
    }

    private function formatTimeRange(?string $startTime, ?string $endTime): string
    {
        if (! $startTime && ! $endTime) {
            return 'All day';
        }

        $start = $startTime ? Carbon::parse($startTime)->format('g:i A') : '12:00 AM';
        $end = $endTime ? Carbon::parse($endTime)->format('g:i A') : 'End of day';

        return "{$start} – {$end}";
    }
}
