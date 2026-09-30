<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Resource extends Model
{
    protected $primaryKey = 'resource_id';
    public $timestamps = false;

    protected $fillable = ['name', 'type', 'status', 'image', 'description'];

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
