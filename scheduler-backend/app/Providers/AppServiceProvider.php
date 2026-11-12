<?php

namespace App\Providers;

use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\HttpClient\NativeHttpClient;
use Symfony\Component\Mailer\Bridge\Brevo\Transport\BrevoTransportFactory;
use Symfony\Component\Mailer\Transport\Dsn;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Mail::extend('brevo', function () {
            $apiKey = config('services.brevo.key');
            if (! is_string($apiKey) || trim($apiKey) === '') {
                throw new \RuntimeException('BREVO_API_KEY is not configured.');
            }

            return (new BrevoTransportFactory(
                client: new NativeHttpClient
            ))->create(
                new Dsn(
                    'brevo+api',
                    'default',
                    $apiKey
                )
            );
        });
    }
}
