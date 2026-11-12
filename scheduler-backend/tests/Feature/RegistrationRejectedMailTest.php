<?php

namespace Tests\Feature;

use App\Mail\RegistrationRejected;
use App\Models\RegistrationRequest;
use Illuminate\Mail\Transport\ArrayTransport;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class RegistrationRejectedMailTest extends TestCase
{
    public function test_rejection_email_references_the_public_system_logo_url(): void
    {
        config(['app.mail_logo_url' => 'https://scheduler.example.com/jabonga-logo.png']);

        $registrationRequest = new RegistrationRequest([
            'full_name' => 'Test Applicant',
            'barangay' => 'Poblacion',
            'reject_reason' => 'Incomplete application',
        ]);

        Mail::mailer('array')
            ->to('applicant@example.com')
            ->send(new RegistrationRejected($registrationRequest));

        $transport = Mail::mailer('array')->getSymfonyTransport();
        $sentMessage = $transport->messages()->first();
        $email = $sentMessage->getOriginalMessage();

        $this->assertInstanceOf(ArrayTransport::class, $transport);
        $this->assertStringContainsString('https://scheduler.example.com/jabonga-logo.png', $email->getHtmlBody());
        $this->assertCount(0, $email->getAttachments());
    }
}
