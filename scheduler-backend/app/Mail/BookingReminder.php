<?php

namespace App\Mail;

use App\Models\BookingRequest;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class BookingReminder extends Mailable
{
    use Queueable, SerializesModels;

    public string $resourceName;

    public function __construct(public BookingRequest $booking)
    {
        $this->resourceName = $booking->resource?->name ?? 'Scheduled Resource';
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Reminder: Upcoming booking for '.$this->resourceName,
        );
    }

    public function content(): Content
    {
        return new Content(view: 'mail.booking.reminder');
    }

    public function attachments(): array
    {
        return [];
    }
}
