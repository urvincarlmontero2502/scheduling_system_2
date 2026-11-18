<?php

$frontendUrl = env(
    'FRONTEND_URL',
    env('APP_ENV', 'production') === 'production'
        ? 'https://jabongascheduler.vercel.app'
        : 'http://localhost:5173'
);
$localOrigins = env('APP_ENV', 'production') === 'production'
    ? []
    : ['http://localhost:5173', 'http://localhost:5174'];
$configuredOrigins = array_map(
    'trim',
    explode(',', env('FRONTEND_ALLOWED_ORIGINS', ''))
);

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    // Set FRONTEND_URL in Render and explicitly list trusted additional origins.
    'allowed_origins' => array_values(array_unique(array_filter(array_merge(
        [$frontendUrl],
        $configuredOrigins,
        $localOrigins
    )))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => true,

];
