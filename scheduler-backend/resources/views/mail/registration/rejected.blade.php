<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #f9fafb;">
  <div style="background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="margin-bottom: 24px;">
      <img src="{{ $logoUrl }}" alt="Jabonga Scheduling System" width="60" height="60" style="display: block; width: 60px; height: 60px;">
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0;">Account Registration Rejected</h1>
    </div>

    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
      Hi {{ $fullName }},
    </p>

    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
      Your registration request for <strong>{{ $barangay }}</strong> has been <strong style="color: #dc2626;">rejected</strong> by the barangay admin.
    </p>

    @if($rejectReason)
    <div style="background: #fef3c7; border: 1px solid #fbbf24; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="font-size: 13px; color: #92400e; margin: 0;">
        <strong>Reason:</strong> {{ $rejectReason }}
      </p>
    </div>
    @endif

    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
      If you believe this was a mistake, or if you would like to re-apply, please contact your barangay administrator directly.
    </p>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 13px; color: #6b7280;">
      <p style="margin: 0 0 4px;">Barangay Admin • {{ $reviewer->full_name ?? 'N/A' }}</p>
      <p style="margin: 0;">Reviewed on {{ $reviewedAt }}</p>
    </div>
  </div>
</div>
