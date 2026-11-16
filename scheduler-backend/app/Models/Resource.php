<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Resource extends Model
{
    use SoftDeletes;
    protected $primaryKey = 'resource_id';
    public $timestamps = false;

    protected $attributes = ['buffer_minutes' => 30];

    protected $fillable = [
        'name',
        'type',
        'status',
        'image',
        'images',
        'description',
        'buffer_minutes',
        'price_per_day',
        'price_per_hour',
        'inclusions',
    ];

    protected function casts(): array
    {
        return [
            'buffer_minutes' => 'integer',
            'images' => 'array',
            'price_per_day' => 'decimal:2',
            'price_per_hour' => 'decimal:2',
        ];
    }

    public function facilityDetails()
    {
        return $this->hasOne(FacilityDetail::class, 'resource_id', 'resource_id');
    }

    public function vehicleDetails()
    {
        return $this->hasOne(VehicleDetail::class, 'resource_id', 'resource_id');
    }

    public function bookings()
    {
        return $this->hasMany(BookingRequest::class, 'resource_id', 'resource_id');
    }
}
