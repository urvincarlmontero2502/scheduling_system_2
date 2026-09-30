<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FacilityDetail extends Model
{
    protected $primaryKey = 'resource_id';
    public $incrementing = false;
    public $timestamps = false;

    protected $fillable = ['resource_id', 'capacity', 'location', 'amenities', 'start_time', 'end_time'];

    public function resource()
    {
        return $this->belongsTo(Resource::class, 'resource_id', 'resource_id');
    }
}
