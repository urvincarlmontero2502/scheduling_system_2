<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SpecialEventTemplate extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'start_year',
        'start_month',
        'start_day',
        'end_month',
        'end_day',
        'resource_ids',
    ];

    protected function casts(): array
    {
        return [
            'resource_ids' => 'array',
        ];
    }
}
