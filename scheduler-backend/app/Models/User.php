<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, Notifiable;

    protected $primaryKey = 'user_id';
    public $timestamps = false;

    protected $fillable = ['full_name', 'email', 'password_hash', 'role', 'department', 'barangay', 'pending_email', 'email_verification_token', 'email_verification_sent_at'];
    protected $hidden = ['password_hash'];

    public function getAuthPassword()
    {
        return $this->password_hash;
    }

    public function bookings()
    {
        return $this->hasMany(BookingRequest::class, 'user_id', 'user_id');
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }
}
