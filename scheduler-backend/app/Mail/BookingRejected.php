<?php

namespace App\Mail;

use App\Models\BookingRequest;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingRejected extends Mailable
{
    use Queueable, SerializesModels;

    public $booking;

    public $user;

    public $resourceName;

    public $remarks;

    public function __construct(BookingRequest $booking, User $user, ?string $remarks = null)
    {
        $this->booking = $booking;
        $this->user = $user;
        $booking->loadMissing(['resource', 'vehicles']);
        $resourceNames = $booking->vehicles->pluck('name')->all();
        $this->resourceName = implode(', ', $resourceNames)
            ?: ($booking->resource?->name ?? 'Unknown Resource');
        $this->remarks = $remarks;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Booking update | Request declined | #'.$this->booking->booking_id,
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'mail.booking.rejected',
        );
    }

    public function attachments(): array
    {
        return [];
    }
}
