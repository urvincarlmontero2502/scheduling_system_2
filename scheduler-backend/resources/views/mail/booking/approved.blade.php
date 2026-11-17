<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking approved</title>
</head>
<body style="margin:0; padding:24px 12px; background:#f1f5f9; color:#172033; font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
        <tr>
            <td align="center">
                <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:620px; border-collapse:separate; background:#ffffff; border:1px solid #dbe3ee; border-radius:12px; overflow:hidden;">
                    <tr>
                        <td style="padding:22px 30px; background:#163b68; color:#ffffff;">
                            <p style="margin:0; font-size:11px; font-weight:bold; letter-spacing:1.4px;">JABONGA SCHEDULING SYSTEM</p>
                            <h1 style="margin:10px 0 0; font-size:23px; line-height:1.3;">Booking approved</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:28px 30px 12px;">
                            <p style="margin:0 0 14px; font-size:16px;">Hello {{ $user->full_name ?? $user->name ?? 'Requestor' }},</p>
                            <p style="margin:0; color:#475569; font-size:14px; line-height:1.7;">
                                Your booking request for <strong style="color:#172033;">{{ implode(', ', $soa['resource_names']) }}</strong> has been approved.
                                Your Statement of Account (SOA) is attached as a PDF. Download or print it to bring to the municipal office for payment—you do not need to visit the barangay to obtain the SOA.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 30px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; background:#eff6ff; border:1px solid #bfdbfe; border-radius:8px;">
                                <tr>
                                    <td style="padding:14px 16px;">
                                        <p style="margin:0 0 5px; color:#475569; font-size:11px; font-weight:bold; letter-spacing:1px;">PAYMENT REFERENCE</p>
                                        <p style="margin:0; color:#1e40af; font-size:20px; font-weight:bold;">{{ $soa['reference_number'] }}</p>
                                    </td>
                                    <td align="right" style="padding:14px 16px;">
                                        <p style="margin:0 0 5px; color:#475569; font-size:11px; font-weight:bold; letter-spacing:1px;">AMOUNT DUE</p>
                                        <p style="margin:0; color:#172033; font-size:18px; font-weight:bold;">
                                            {{ $soa['amount_formatted'] ?? 'For assessment at the municipal office' }}
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:4px 30px 10px;">
                            <h2 style="margin:0 0 10px; color:#334155; font-size:13px; letter-spacing:.8px; text-transform:uppercase;">Booking details</h2>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; border:1px solid #e2e8f0;">
                                <tr>
                                    <td width="34%" style="padding:10px 12px; border-bottom:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:12px;">{{ $soa['resource_type'] === 'Vehicle' ? 'Requested vehicles' : 'Resource' }}</td>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#172033; font-size:13px; font-weight:bold;">{{ implode(', ', $soa['resource_names']) }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:12px;">Booking ID</td>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#172033; font-size:13px;">#{{ $soa['booking_id'] }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:12px;">Schedule</td>
                                    <td style="padding:10px 12px; border-bottom:1px solid #e2e8f0; color:#172033; font-size:13px;">{{ $soa['start_date'] }}@if($soa['end_date'] !== $soa['start_date']) – {{ $soa['end_date'] }}@endif; {{ $soa['time'] }}</td>
                                </tr>
                                <tr>
                                    <td style="padding:10px 12px; background:#f8fafc; color:#64748b; font-size:12px;">Charge basis</td>
                                    <td style="padding:10px 12px; color:#172033; font-size:13px;">
                                        @if($soa['duration'])
                                            {{ $soa['duration'] }} duration; {{ $soa['quantity_label'] }}
                                        @else
                                            {{ $soa['quantity_label'] }}
                                        @endif
                                    </td>
                                </tr>
                                @foreach($soa['charges'] as $charge)
                                    <tr>
                                        <td style="padding:10px 12px; border-top:1px solid #e2e8f0; background:#f8fafc; color:#64748b; font-size:12px;">{{ $charge['resource_name'] }}</td>
                                        <td style="padding:10px 12px; border-top:1px solid #e2e8f0; color:#172033; font-size:13px;">
                                            {{ $charge['rate'] === null ? 'Rate to be assessed' : '₱'.number_format($charge['rate'], 2).' per '.($soa['resource_type'] === 'Vehicle' ? 'hour' : 'day') }}
                                            · {{ $charge['amount_formatted'] ?? 'Amount to be assessed' }}
                                        </td>
                                    </tr>
                                @endforeach
                            </table>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:18px 30px 26px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; border-top:1px solid #e2e8f0;">
                                <tr>
                                    <td style="padding-top:16px; color:#475569; font-size:12px; line-height:1.7;">
                                        The attached SOA is not an official receipt. Present it and quote the payment reference at the municipal office. An official receipt will be provided after payment.
                                    </td>
                                </tr>
                            </table>
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
