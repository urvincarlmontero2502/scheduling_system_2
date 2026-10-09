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
        'status',
        'is_special_event',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'is_special_event' => 'boolean',
        ];
    }

    /**
     * Scope a query to exclude special events (annual festivals, alumni reunions, etc.).
     */
    public function scopeNotSpecialEvent($query)
    {
        $query->where('is_special_event', false);
    }

    /**
     * Scope a query to include only special events.
     */
    public function scopeSpecialEvent($query)
    {
        $query->where('is_special_event', true);
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
