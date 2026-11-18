<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsConfigurationTest extends TestCase
{
    public function test_preflight_allows_configured_origin_with_credentials(): void
    {
        config([
            'cors.allowed_origins' => [
                'https://frontend.example.test',
                'https://admin.example.test',
            ],
            'cors.allowed_origins_patterns' => [],
            'cors.supports_credentials' => true,
        ]);

        $allowed = $this->call('OPTIONS', '/api/registration-lookup', [], [], [], [
            'HTTP_ORIGIN' => 'https://frontend.example.test',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,authorization',
        ]);

        $this->assertSame(
            'https://frontend.example.test',
            $allowed->headers->get('Access-Control-Allow-Origin')
        );
        $this->assertNotSame(
            '*',
            $allowed->headers->get('Access-Control-Allow-Origin')
        );
        $this->assertStringContainsString(
            'POST',
            $allowed->headers->get('Access-Control-Allow-Methods')
        );
        $this->assertSame(
            'true',
            $allowed->headers->get('Access-Control-Allow-Credentials')
        );
    }

    public function test_preflight_rejects_untrusted_origin(): void
    {
        config([
            'cors.allowed_origins' => [
                'https://frontend.example.test',
                'https://admin.example.test',
            ],
            'cors.allowed_origins_patterns' => [],
            'cors.supports_credentials' => true,
        ]);

        $rejected = $this->call('OPTIONS', '/api/registration-lookup', [], [], [], [
            'HTTP_ORIGIN' => 'https://untrusted.example.test',
            'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'POST',
            'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,authorization',
        ]);
        $this->assertNull($rejected->headers->get('Access-Control-Allow-Origin'));
    }
}
