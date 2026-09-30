<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VehicleDetail extends Model
{
    protected $primaryKey = 'resource_id';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['resource_id', 'driver_name', 'unit_name', 'plate_number'];

    public function resource()
    {
        return $this->belongsTo(Resource::class, 'resource_id', 'resource_id');
    }
}
