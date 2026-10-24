<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $table = 'notifications';
    protected $primaryKey = 'notif_id';
    public $timestamps = false;

    protected $fillable = ['booking_id', 'user_id', 'message', 'is_read', 'type', 'title', 'read_at', 'created_at'];

    protected $casts = [
        'is_read' => 'boolean',
        'read_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function booking()
    {
        return $this->belongsTo(BookingRequest::class, 'booking_id', 'booking_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    public function scopeUnread($query)
    {
        return $query->where('is_read', false);
    }

    public function markAsRead()
    {
        $this->update(['is_read' => true, 'read_at' => now()]);
    }
}
