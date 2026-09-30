<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Approval extends Model
{
    protected $table = 'approval';
    protected $primaryKey = 'log_id';
    public $timestamps = false;

    protected $fillable = ['booking_id', 'admin_id', 'action', 'remarks'];

    public function booking()
    {
        return $this->belongsTo(BookingRequest::class, 'booking_id', 'booking_id');
    }

    public function admin()
    {
        return $this->belongsTo(User::class, 'admin_id', 'user_id');
    }
}
