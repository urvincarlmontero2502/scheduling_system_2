<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingRequest extends Model
{
    protected $table = 'booking_request';
    protected $primaryKey = 'booking_id';
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'resource_id',
        'full_name', // <-- Add this here so it saves properly!
        'purpose',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'cell_number',
        'address',
        'status'
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function resource()
    {
        return $this->belongsTo(Resource::class, 'resource_id', 'resource_id');
    }

    public function approvals()
    {
        return $this->hasMany(Approval::class, 'booking_id', 'booking_id');
    }

    public function notifications()
    {
        return $this->hasMany(Notification::class, 'booking_id', 'booking_id');
    }
}
