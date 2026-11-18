<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BookingRequest extends Model
{
    use SoftDeletes;

    protected $table = 'booking_request';

    protected $primaryKey = 'booking_id';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'resource_id',
        'full_name', // <-- Add this here so it saves properly!
        'purpose',
        'destination',
        'price_per_day',
        'price_per_hour',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'cell_number',
        'address',
        'email',
        'status',
        'is_special_event',
        'special_event_template_id',
        'attendees',
        'priority',
        'reference_id',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'is_special_event' => 'boolean',
            'reminder_sent_at' => 'datetime',
            'reminder_sms_sent_at' => 'datetime',
            'deleted_at' => 'datetime',
            'price_per_day' => 'decimal:2',
            'price_per_hour' => 'decimal:2',
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
        return $this->belongsTo(Resource::class, 'resource_id', 'resource_id')->withTrashed();
    }

    public function vehicles()
    {
        return $this->belongsToMany(
            Resource::class,
            'booking_vehicles',
            'booking_id',
            'resource_id',
            'booking_id',
            'resource_id'
        )
            ->withPivot('price_per_hour')
            ->withTrashed();
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
