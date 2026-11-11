<?php

namespace Tests\Feature;

use Tests\TestCase;

class GoogleOAuthRedirectTest extends TestCase
{
    public function test_google_redirect_returns_the_frontend_callback_uri(): void
    {
        config([
            'services.google.client_id' => 'test-client-id',
            'services.google.redirect' => 'https://scheduler.example/auth/google/callback',
        ]);

        $response = $this->getJson('/api/auth/google');

        $response->assertOk();
        $query = [];
        parse_str((string) parse_url($response->json('redirect'), PHP_URL_QUERY), $query);

        $this->assertSame(
            'https://scheduler.example/auth/google/callback',
            $query['redirect_uri'] ?? null
        );
        $this->assertSame('test-client-id', $query['client_id'] ?? null);
    }

    public function test_google_redirect_reports_missing_oauth_configuration(): void
    {
        config([
            'services.google.client_id' => null,
            'services.google.redirect' => null,
        ]);

        $this->getJson('/api/auth/google')
            ->assertInternalServerError()
            ->assertJsonPath(
                'message',
                'Google OAuth is not configured on the server. Please set GOOGLE_CLIENT_ID and FRONTEND_URL environment variables.'
            );
    }
}
