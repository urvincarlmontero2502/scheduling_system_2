<?php

namespace App\Mail;

use App\Models\RegistrationRequest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class RegistrationApproved extends Mailable
{
    use Queueable, SerializesModels;

    public $registrationRequest;
    public $user;        // The newly created user account
    public $reviewer;    // The admin who approved
    public $loginUrl;

    public function __construct(RegistrationRequest $registrationRequest, User $user, ?User $reviewer = null)
    {
        $this->registrationRequest = $registrationRequest;
        $this->user = $user;
        $this->reviewer = $reviewer;
        $this->loginUrl = config('app.frontend_url', 'http://scheduler-frontend.test') . '/login';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Your Account Has Been Approved — ' . $this->user->barangay,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.registration.approved',
            with: [
                'user'        => $this->user,
                'reviewer'    => $this->reviewer,
                'approvedAt'  => now()->format('F j, Y \a\t g:i A'),
                'loginUrl'    => $this->loginUrl,
            ],
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
