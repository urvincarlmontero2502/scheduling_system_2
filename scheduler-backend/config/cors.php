<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Set FRONTEND_URL in Render to your Vercel URL (no trailing slash)
    // If not set, we allow any HTTPS origin for the auth/registration flow
    // (Bearer tokens are used, not cookies, so CORS security is not a concern)
    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL'),
        env('APP_URL'),
        'http://localhost:5173',
    ])),

    // Allow any HTTPS origin as a fallback — registration is the entry point
    // for new users and must never be blocked by CORS
    'allowed_origins_patterns' => ['^https://.*'],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Bearer tokens are used, not cookies
    'supports_credentials' => false,

];
