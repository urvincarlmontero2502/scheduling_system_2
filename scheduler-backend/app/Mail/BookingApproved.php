<?php

namespace App\Mail;

use App\Models\BookingRequest;
use App\Models\User;
use App\Services\BookingStatementOfAccount;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Attachment;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingApproved extends Mailable
{
    use Queueable, SerializesModels;

    public $booking;

    public $user;

    public $resourceName;

    public array $soa;

    public function __construct(BookingRequest $booking, User $user)
    {
        $this->booking = $booking;
        $this->user = $user;
        $this->resourceName = $booking->resource ? $booking->resource->name : 'Unknown Resource';
        $this->soa = app(BookingStatementOfAccount::class)->build($booking);
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Booking approved | '.$this->soa['reference_number'],
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.booking.approved',
        );
    }

    public function attachments(): array
    {
        return [
            Attachment::fromData(
                fn () => Pdf::loadView('mail.booking.soa', ['soa' => $this->soa])
                    ->setPaper('a4')
                    ->output(),
                $this->soa['file_name']
            )->withMime('application/pdf'),
        ];
    }
}
