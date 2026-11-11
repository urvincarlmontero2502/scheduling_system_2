<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Mail;
use ReflectionProperty;
use RuntimeException;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoApiTransport;
use Tests\TestCase;

class BrevoMailerTest extends TestCase
{
    public function test_brevo_transport_uses_the_configured_api_key(): void
    {
        config(['services.brevo.key' => 'test-brevo-api-key']);
        Mail::purge('brevo');

        $transport = Mail::mailer('brevo')->getSymfonyTransport();
        $apiKey = (new ReflectionProperty(BrevoApiTransport::class, 'key'))
            ->getValue($transport);

        $this->assertSame('test-brevo-api-key', $apiKey);
    }

    public function test_brevo_transport_reports_a_missing_api_key(): void
    {
        config(['services.brevo.key' => null]);
        Mail::purge('brevo');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('BREVO_API_KEY is not configured.');

        Mail::mailer('brevo')->getSymfonyTransport();
    }
}
