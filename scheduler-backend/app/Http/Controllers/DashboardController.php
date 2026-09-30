<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\BookingRequest;
use App\Models\Resource;

class DashboardController extends Controller
{
    public function stats()
    {
        return response()->json([
            'pending' => BookingRequest::where('status', 'pending')->count(),
            'approved' => BookingRequest::where('status', 'approved')->count(),
            'resources' => Resource::count(),
        ]);
    }
}
