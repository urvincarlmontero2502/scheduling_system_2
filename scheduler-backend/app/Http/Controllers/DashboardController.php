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
            'pending' => BookingRequest::where('status', 'pending')
                ->where('purpose', 'not like', '%Festival%')
                ->where('purpose', 'not like', '%Alumni%')
                ->where('purpose', 'not like', '%Habongan%')
                ->count(),
            'approved' => BookingRequest::where('status', 'approved')
                ->where('purpose', 'not like', '%Festival%')
                ->where('purpose', 'not like', '%Alumni%')
                ->where('purpose', 'not like', '%Habongan%')
                ->count(),
            'resources' => Resource::count(),
        ]);
    }
}
