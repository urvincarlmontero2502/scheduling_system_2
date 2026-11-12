<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BookingRemovalRequest extends Model
{
    protected $table = 'booking_removal_requests';

    protected $primaryKey = 'removal_request_id';

    public $timestamps = false;

    protected $fillable = [
        'booking_id',
        'requested_by',
        'requester_name',
        'requester_role',
        'reason',
        'booking_snapshot',
        'status',
        'reviewed_by',
        'review_note',
        'requested_at',
        'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'booking_snapshot' => 'array',
            'requested_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function booking()
    {
        return $this->belongsTo(BookingRequest::class, 'booking_id', 'booking_id');
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by', 'user_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'user_id');
    }
}
