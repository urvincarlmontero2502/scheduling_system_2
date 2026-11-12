<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        if (!$request->user() || !$request->user()->isAdmin()) {
            // Allow barangay_admin role to pass through for barangay-scoped review routes.
            if ($request->user() && $request->user()->isBarangayAdmin()) {
                $path = $request->path();
                // Barangay admins can only access their scoped review endpoints.
                // Check both with and without the 'api/' prefix
                if (
                    str_contains($path, 'registration-requests')
                    || str_contains($path, 'booking-removal-requests')
                ) {
                    return $next($request);
                }
            }
            return response()->json(['message' => 'Forbidden — admin access required.'], 403);
        }

        return $next($request);
    }
}
