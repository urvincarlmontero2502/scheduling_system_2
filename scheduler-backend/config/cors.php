<?php

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Set FRONTEND_URL in Render to your Vercel URL (no trailing slash)
    'allowed_origins' => array_values(array_filter([
        env('FRONTEND_URL'),
        env('APP_URL'),
        'http://localhost:5173',
    ])),

    // Allow any origin as a last resort (for registration flow which must
    // never be blocked by CORS — registration is the entry point for new users)
    'allowed_origins_patterns' => [
        env('FRONTEND_URL') ? '^https://.*' : null,
    ],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // Bearer tokens are used, not cookies
    'supports_credentials' => false,

];
