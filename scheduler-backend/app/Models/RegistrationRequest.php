<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RegistrationRequest extends Model
{
    protected $table = 'registration_requests';
    protected $primaryKey = 'request_id';
    public $timestamps = false;

    // Ensure updated_at is handled
    const UPDATED_AT = 'updated_at';

    protected $fillable = [
        'full_name',
        'email',
        'password_hash',
        'google_id',
        'avatar',
        'barangay',
        'department',
        'role',
        'status',
        'reject_reason',
        'reviewed_by',
        'reviewed_at',
    ];

    protected $hidden = ['password_hash'];

    protected $casts = [
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'reviewed_at' => 'datetime',
    ];

    /**
     * Barangay admin email mapping — the specific barangay admin
     * who receives notifications for new registration requests.
     */
    public const BARANGAY_ADMIN_EMAILS = [
        'Bunga'         => 'bunga.jabonga.blgu@gmail.com',
        'San Pablo'     => 'Sanpablojabongaadn@gmail.com',
        'Cuyago'        => 'blgucuyago@gmail.com',
        'Libas'         => 'blgulibas8607@gmail.com',
        'Maraiging'     => 'blgumaraiging@gmail.com',
        'Bangonay'      => 'bdrrmbangonay@gmail.com',
        'A. Beltran'    => 'blguabeltranjabonga@gmail.com',
        'Magsaysay'     => 'bmagsaysayjabonga@gmail.com',
        'Baleguian'     => 'blgubaleguian@gmail.com',
        'Santo Nino'    => 'santonino583@gmail.com',
        'Poblacion'     => 'poblacion@system.local',
    ];

    /**
     * Get the barangay admin email for a given barangay name.
     */
    public static function getAdminEmail(string $barangay): ?string
    {
        return self::BARANGAY_ADMIN_EMAILS[$barangay] ?? null;
    }

    /**
     * Get the reviewer (admin who approved/rejected) user.
     */
    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by', 'user_id');
    }
}
