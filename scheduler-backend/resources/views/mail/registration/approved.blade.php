<div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #f9fafb;">
  <div style="background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
    <div style="display: flex; align-items-center; gap: 12px; margin-bottom: 24px;">
      <div style="width: 48px; height: 48px; background: #dcfce8; border-radius: full; display: flex; align-items: center; justify-content: center;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2">
          <path d="M22 11V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5a2 2 0 0 0-2-2h-1V7a2 2 0 0 1 2-2h3z"/>
        </svg>
      </div>
      <h1 style="font-size: 22px; font-weight: 700; color: #111827; margin: 0;">Account Approved</h1>
    </div>

    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
      Hi {{ $user->full_name }},
    </p>

    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
      Great news! Your registration request for <strong>{{ $user->barangay }}</strong> has been <strong style="color: #16a34a;">approved</strong>.
    </p>

    <p style="color: #374151; font-size: 15px; line-height: 1.6; margin-bottom: 32px;">
      You can now log in to the Facility & Vehicle Scheduler system using your email address. Your default password is set — you may change it after logging in.
    </p>

    <div style="text-align: center; margin-bottom: 32px;">
      <a href="{{ $loginUrl }}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 28px; border-radius: 8px; font-weight: 600; font-size: 14px; text-decoration: none;">
        Log In to Your Account
      </a>
    </div>

    <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 13px; color: #6b7280;">
      <p style="margin: 0 0 4px;">Barangay Admin • {{ $reviewer->full_name ?? 'N/A' }}</p>
      <p style="margin: 0;">Approved on {{ $approvedAt }}</p>
    </div>
  </div>
</div>
