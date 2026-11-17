<?php

namespace App\Services;

use App\Models\BookingRequest;
use Carbon\Carbon;

class BookingStatementOfAccount
{
    public function build(BookingRequest $booking): array
    {
        $booking->loadMissing(['resource', 'user', 'vehicles']);

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
                $vehicles = $booking->vehicles;
                if ($vehicles->isEmpty()) {
                    $vehicles = collect([$resource]);
                }
                $charges = $vehicles->map(function ($vehicle) use ($booking, $quantity) {
                    $rate = $this->validRate(
                        $vehicle->pivot?->price_per_hour
                            ?? ((int) $vehicle->resource_id === (int) $booking->resource_id
                                ? $booking->price_per_hour
                                : $vehicle->price_per_hour)
                    );
                    $amount = $rate !== null && $quantity > 0
                        ? round($rate * $quantity, 2)
                        : null;

                    return [
                        'resource_name' => $vehicle->name,
                        'quantity' => $quantity,
                        'quantity_label' => "{$quantity} billable hour".($quantity === 1 ? '' : 's'),
                        'rate' => $rate,
                        'amount' => $amount,
                        'amount_formatted' => $amount === null ? null : '₱'.number_format($amount, 2),
                    ];
                })->values();
                $rate = $charges->count() === 1 ? $charges->first()['rate'] : null;
                $amount = $charges->contains(fn ($charge) => $charge['amount'] === null)
                    ? null
                    : round((float) $charges->sum('amount'), 2);
                $chargeTitle = $charges->count() === 1 ? 'Vehicle rental' : 'Vehicle rentals';
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
            $amount = $rate !== null && $quantity > 0
                ? round($rate * $quantity, 2)
                : null;
            $charges = collect([[
                'resource_name' => $resource?->name ?? 'Unknown Resource',
                'quantity' => $quantity,
                'quantity_label' => "{$quantity} booked day".($quantity === 1 ? '' : 's'),
                'rate' => $rate,
                'amount' => $amount,
                'amount_formatted' => $amount === null ? null : '₱'.number_format($amount, 2),
            ]]);
            $chargeTitle = 'Facility use';
            $quantityLabel = "{$quantity} booked day".($quantity === 1 ? '' : 's');
            $rateLabel = 'Daily rate';
            $durationLabel = null;
        }

        $referenceNumber = $booking->reference_id ?: '#'.$booking->booking_id;
        $safeReference = preg_replace('/[^A-Za-z0-9._-]/', '-', $referenceNumber);
        $resourceNames = $charges->pluck('resource_name')->all();
        $formattedAmount = $amount === null ? null : '₱'.number_format($amount, 2);

        return [
            'reference_number' => $referenceNumber,
            'booking_id' => $booking->booking_id,
            'client_name' => $booking->full_name ?: ($booking->user?->full_name ?: 'Requestor'),
            'barangay' => $booking->user?->barangay ?: '—',
            'contact_number' => $booking->cell_number ?: '—',
            'email' => $booking->email ?: ($booking->user?->email ?: '—'),
            'address' => $booking->address ?: '—',
            'resource_name' => implode(', ', $resourceNames),
            'resource_names' => $resourceNames,
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
            'amount_formatted' => $formattedAmount,
            'charges' => $charges->all(),
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
