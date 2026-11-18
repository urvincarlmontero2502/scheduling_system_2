<?php

return [
    'secret' => env('RECAPTCHA_SECRET_KEY'),
    'minimum_score' => (float) env('RECAPTCHA_MINIMUM_SCORE', 0.5),
    'login_action' => 'login',
    'allowed_hostnames' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('RECAPTCHA_ALLOWED_HOSTNAMES', ''))
    ))),
];
