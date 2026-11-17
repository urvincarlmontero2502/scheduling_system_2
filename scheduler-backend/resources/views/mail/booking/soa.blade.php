<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        @page { margin: 40px 42px; }
        body { color: #172033; font-family: DejaVu Sans, sans-serif; font-size: 11px; line-height: 1.5; }
        .header { border-bottom: 2px solid #163b68; padding-bottom: 16px; text-align: center; }
        .header .eyebrow { color: #64748b; font-size: 9px; font-weight: bold; letter-spacing: 1.5px; }
        .header h1 { margin: 5px 0 2px; color: #163b68; font-size: 17px; }
        .header p { margin: 0; color: #64748b; font-size: 10px; }
        .title { margin: 22px 0 14px; text-align: center; }
        .title h2 { margin: 0; font-size: 18px; letter-spacing: 1px; }
        .title p { margin: 5px 0 0; color: #64748b; font-size: 10px; }
        .reference { margin-bottom: 16px; padding: 12px 14px; border: 1px solid #bfdbfe; background: #eff6ff; }
        .reference-label { color: #475569; font-size: 8px; font-weight: bold; letter-spacing: 1px; }
        .reference-value { margin-top: 3px; color: #1e40af; font-size: 16px; font-weight: bold; }
        .section-title { margin: 17px 0 6px; color: #334155; font-size: 9px; font-weight: bold; letter-spacing: .8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 8px 10px; border: 1px solid #dbe3ee; text-align: left; vertical-align: top; }
        th { width: 30%; background: #f8fafc; color: #64748b; font-size: 9px; font-weight: normal; }
        td { color: #172033; font-size: 10px; }
        .charges th, .charges td { text-align: right; }
        .charges th:first-child, .charges td:first-child { text-align: left; }
        .amount-row td { background: #eff6ff; color: #1e40af; font-size: 12px; font-weight: bold; }
        .note { margin-top: 17px; padding: 10px 12px; border-left: 3px solid #2563eb; background: #f8fafc; color: #475569; font-size: 9px; }
        .signatures { margin-top: 48px; }
        .signatures td { width: 50%; padding: 22px 12px 4px; border: 0; border-top: 1px solid #94a3b8; color: #64748b; text-align: center; font-size: 9px; }
        .footer { margin-top: 20px; color: #94a3b8; text-align: center; font-size: 8px; }
    </style>
</head>
<body>
    <div class="header">
        <div class="eyebrow">REPUBLIC OF THE PHILIPPINES</div>
        <h1>MUNICIPALITY OF JABONGA</h1>
        <p>AGUSAN DEL NORTE</p>
    </div>

    <div class="title">
        <h2>STATEMENT OF ACCOUNT</h2>
        <p>Approved resource booking · Issued {{ $soa['generated_at'] }}</p>
    </div>

    <div class="reference">
        <div class="reference-label">PAYMENT REFERENCE NUMBER</div>
        <div class="reference-value">{{ $soa['reference_number'] }}</div>
    </div>

    <div class="section-title">CLIENT INFORMATION</div>
    <table>
        <tr><th>Client name</th><td>{{ $soa['client_name'] }}</td></tr>
        <tr><th>Barangay</th><td>{{ $soa['barangay'] }}</td></tr>
        <tr><th>Contact number</th><td>{{ $soa['contact_number'] }}</td></tr>
        <tr><th>Email</th><td>{{ $soa['email'] }}</td></tr>
        <tr><th>Address</th><td>{{ $soa['address'] }}</td></tr>
    </table>

    <div class="section-title">BOOKING INFORMATION</div>
    <table>
        <tr><th>Booking ID</th><td>#{{ $soa['booking_id'] }}</td></tr>
        <tr><th>{{ $soa['resource_type'] === 'Vehicle' ? 'Requested vehicles' : 'Resource' }}</th><td>{{ $soa['resource_name'] }}</td></tr>
        <tr><th>Schedule</th><td>{{ $soa['start_date'] }}@if($soa['end_date'] !== $soa['start_date']) – {{ $soa['end_date'] }}@endif; {{ $soa['time'] }}</td></tr>
        @if($soa['destination'])
            <tr><th>Destination</th><td>{{ $soa['destination'] }}</td></tr>
        @endif
        <tr><th>Purpose</th><td>{{ $soa['purpose'] }}</td></tr>
    </table>

    <div class="section-title">CHARGES</div>
    <table class="charges">
        <tr>
            <th>Description</th>
            <th>Quantity</th>
            <th>Rate</th>
            <th>Amount</th>
        </tr>
        @foreach($soa['charges'] as $charge)
            <tr>
                <td>{{ $soa['charge_title'] }} — {{ $charge['resource_name'] }}@if($soa['duration']) ({{ $soa['duration'] }})@endif</td>
                <td>{{ $charge['quantity_label'] }}</td>
                <td>{{ $charge['rate'] === null ? 'For assessment' : '₱'.number_format($charge['rate'], 2) }}</td>
                <td>{{ $charge['amount_formatted'] ?? 'For assessment' }}</td>
            </tr>
        @endforeach
        <tr class="amount-row">
            <td colspan="3">TOTAL AMOUNT DUE</td>
            <td>{{ $soa['amount_formatted'] ?? 'To be assessed' }}</td>
        </tr>
    </table>

    <div class="note">
        This statement is not an official receipt. Present this SOA and quote the reference number at the municipal office for payment. The amount is subject to verification; an official receipt will be issued after payment.
    </div>

    <table class="signatures">
        <tr>
            <td>Client / Authorized Representative</td>
            <td>Office Verification</td>
        </tr>
    </table>

    <div class="footer">Generated electronically by the Jabonga Scheduling System · Reference {{ $soa['reference_number'] }}</div>
</body>
</html>
