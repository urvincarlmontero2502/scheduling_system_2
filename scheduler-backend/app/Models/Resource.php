<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Resource extends Model
{
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
    ];

    protected function casts(): array
    {
        return [
            'buffer_minutes' => 'integer',
            'images' => 'array',
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
