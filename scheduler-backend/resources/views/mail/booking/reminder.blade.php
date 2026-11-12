<div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 28px; color: #1f2937; background: #f9fafb;">
  <div style="padding: 28px; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px;">
    <h1 style="margin: 0 0 20px; font-size: 22px; color: #111827;">Upcoming booking reminder</h1>

    <p style="font-size: 15px; line-height: 1.6;">Hello {{ $booking->full_name ?: $booking->user?->full_name ?: 'there' }},</p>

    <p style="font-size: 15px; line-height: 1.6;">
      This is a reminder about your approved booking for
      <strong>{{ $resourceName }}</strong>.
    </p>

    <div style="margin: 20px 0; padding: 16px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; line-height: 1.7;">
      <strong>Date:</strong> {{ \Carbon\Carbon::parse($booking->start_date)->format('F j, Y') }}
      @if($booking->start_time && $booking->end_time)
        <br><strong>Time:</strong> {{ $booking->start_time }} – {{ $booking->end_time }}
      @endif
      @if($booking->purpose)
        <br><strong>Purpose:</strong> {{ $booking->purpose }}
      @endif
      @if($booking->reference_id)
        <br><strong>Reference:</strong> {{ $booking->reference_id }}
      @endif
    </div>

    <p style="font-size: 14px; line-height: 1.6; color: #4b5563;">
      Please contact the barangay office if your plans have changed.
    </p>
    <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280;">Jabonga Facility &amp; Vehicle Scheduler</p>
  </div>
</div>
