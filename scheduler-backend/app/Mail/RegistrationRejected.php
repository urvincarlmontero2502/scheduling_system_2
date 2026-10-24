<?php

namespace App\Mail;

use App\Models\RegistrationRequest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RegistrationRejected extends Mailable
{
    use Queueable, SerializesModels;

    public $registrationRequest;
    public $reviewer;
    public $fullName;
    public $barangay;
    public $rejectReason;

    public function __construct(RegistrationRequest $registrationRequest, ?User $reviewer = null)
    {
        $this->registrationRequest = $registrationRequest;
        $this->reviewer = $reviewer;
        $this->fullName = $registrationRequest->full_name;
        $this->barangay = $registrationRequest->barangay;
        $this->rejectReason = $registrationRequest->reject_reason;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your Registration Request Was Not Approved — ' . $this->barangay,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.registration.rejected',
            with: [
                'fullName'    => $this->fullName,
                'barangay'    => $this->barangay,
                'rejectReason'=> $this->rejectReason,
                'reviewer'    => $this->reviewer,
                'reviewedAt'  => $this->registrationRequest->reviewed_at
                    ? \Carbon\Carbon::parse($this->registrationRequest->reviewed_at)->format('F j, Y \a\t g:i A')
                    : now()->format('F j, Y \a\t g:i A'),
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
