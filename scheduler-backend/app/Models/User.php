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

    protected $fillable = ['full_name', 'email', 'password_hash', 'role', 'department', 'barangay', 'pending_email', 'email_verification_token', 'email_verification_sent_at', 'google_id', 'profile_image', 'email_verified_at', 'avatar'];
    protected $hidden = ['password_hash'];

    protected $appends = ['profile_image_url'];

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

    /**
     * Resolve profile image URL with fallback to generated avatar.
     * Checks Google avatar first, then uploaded profile_image, then ui-avatars.com fallback.
     */
    public function getProfileImageUrlAttribute(): string
    {
        // Check Google avatar first (stored during JIT registration)
        if ($this->avatar) {
            if (filter_var($this->avatar, FILTER_VALIDATE_URL)) {
                return $this->avatar;
            }
            return asset('storage/' . $this->avatar);
        }

        // Then check uploaded profile_image
        if ($this->profile_image) {
            if (filter_var($this->profile_image, FILTER_VALIDATE_URL)) {
                return $this->profile_image;
            }
            return asset('storage/' . $this->profile_image);
        }

        $initials = $this->getInitials();
        $colors = ['blue', 'green', 'purple', 'red', 'orange'];
        $color = $colors[crc32($this->full_name ?? $this->email) % count($colors)];

        return sprintf(
            'https://ui-avatars.com/api/?name=%s&background=%s&size=64&font-bold=true',
            urlencode($initials),
            $color
        );
    }

    private function getInitials(): string
    {
        $name = $this->full_name ?? $this->email;
        $words = explode(' ', $name);
        $initials = '';
        foreach ($words as $word) {
            $initials .= strtoupper(substr($word, 0, 1));
        }
        return $initials ?: 'U';
    }
}
