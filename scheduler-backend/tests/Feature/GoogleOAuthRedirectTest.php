<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Cache;
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
        $this->assertNotEmpty($query['state'] ?? null);
        $this->assertTrue(Cache::has('google_oauth_state:'.$query['state']));
    }

    public function test_google_callback_rejects_missing_or_invalid_state(): void
    {
        config([
            'services.google.client_id' => 'test-client-id',
            'services.google.client_secret' => 'test-client-secret',
        ]);

        $this->postJson('/api/auth/google/callback', [
            'code' => 'authorization-code',
            'state' => 'not-issued-by-this-server',
        ])
            ->assertUnprocessable()
            ->assertJsonPath(
                'message',
                'The Google sign-in request is invalid or has expired. Please try again.'
            );
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
