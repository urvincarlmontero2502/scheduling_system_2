<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking request update</title>
</head>
<body style="margin:0; padding:24px 12px; background:#f1f5f9; color:#172033; font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
            <td align="center">
                <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:620px; border-collapse:separate; background:#ffffff; border:1px solid #dbe3ee; border-radius:12px; overflow:hidden;">
                    <tr>
                        <td style="padding:22px 30px; background:#7f1d1d; color:#ffffff;">
                            <p style="margin:0; font-size:11px; font-weight:bold; letter-spacing:1.4px;">JABONGA SCHEDULING SYSTEM</p>
                            <h1 style="margin:10px 0 0; font-size:23px; line-height:1.3;">Booking request update</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 30px 12px;">
                            <p style="margin:0 0 14px; font-size:16px;">Hello {{ $user->full_name ?? $user->name ?? 'Requestor' }},</p>
                            <p style="margin:0; color:#475569; font-size:14px; line-height:1.7;">
                                We’re sorry, but your booking request for <strong style="color:#172033;">{{ $resourceName }}</strong> was not approved.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 30px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; background:#fff7ed; border:1px solid #fed7aa;">
                                <tr>
                                    <td style="padding:14px 16px;">
                                        <p style="margin:0 0 5px; color:#9a3412; font-size:11px; font-weight:bold; letter-spacing:1px;">BOOKING REFERENCE</p>
                                        <p style="margin:0; color:#7c2d12; font-size:18px; font-weight:bold;">
                                            {{ $booking->reference_id ?: '#'.$booking->booking_id }}
                                        </p>
                                    </td>
                                    <td align="right" style="padding:14px 16px;">
                                        <span style="display:inline-block; padding:6px 10px; border-radius:20px; background:#fee2e2; color:#991b1b; font-size:11px; font-weight:bold; letter-spacing:.5px;">NOT APPROVED</span>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:4px 30px 10px;">
                            <h2 style="margin:0 0 10px; color:#334155; font-size:13px; letter-spacing:.8px; text-transform:uppercase;">Request details</h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; border:1px solid #e2e8f0;">
                                <tr>
                                    <td width="34%" style="padding:10px 12px; border-bottom:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:12px;">Resource</td>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#172033; font-size:13px; font-weight:bold;">{{ $resourceName }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:12px;">Booking ID</td>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#172033; font-size:13px;">#{{ $booking->booking_id }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:12px;">Start date</td>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#172033; font-size:13px;">{{ \Carbon\Carbon::parse($booking->start_date)->format('M d, Y') }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 12px; background:#f8fafc; color:#64748b; font-size:12px;">End date</td>
                                    <td style="padding:10px 12px; color:#172033; font-size:13px;">{{ \Carbon\Carbon::parse($booking->end_date)->format('M d, Y') }}</td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    @if($remarks)
                        <tr>
                            <td style="padding:12px 30px;">
                                <h2 style="margin:0 0 8px; color:#334155; font-size:13px; letter-spacing:.8px; text-transform:uppercase;">Reason provided</h2>
                                <div style="padding:13px 15px; border-left:3px solid #ef4444; background:#fff7f7; color:#475569; font-size:13px; line-height:1.7;">
                                    {{ $remarks }}
                                </div>
                            </td>
                        </tr>
                    @endif
                    <tr>
                        <td style="padding:14px 30px 28px; color:#475569; font-size:13px; line-height:1.7;">
                            If you have questions or would like to request another date or time, please contact the municipal office or submit a new booking request through the scheduling system.
                        </td>
                    </tr>
                    <tr>
                        <td align="center" style="padding:16px 24px; background:#f8fafc; color:#64748b; font-size:11px; line-height:1.6;">
                            This is an automated message from the Jabonga Scheduling System. Please do not reply to this email.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
