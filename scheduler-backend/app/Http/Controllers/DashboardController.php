<?php

namespace App\Http\Controllers;

use App\Models\BookingRequest;
use App\Models\Resource;

class DashboardController extends Controller
{
    public function stats()
    {
        return response()->json([
            'pending' => BookingRequest::notSpecialEvent()
                ->where('status', 'pending')
                ->count(),
            'approved' => BookingRequest::notSpecialEvent()
                ->where('status', 'approved')
                ->count(),
            'resources' => Resource::count(),
        ]);
    }
}
