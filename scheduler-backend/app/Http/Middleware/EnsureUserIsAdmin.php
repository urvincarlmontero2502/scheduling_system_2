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
            // Allow barangay_admin role to pass through for registration request routes
            if ($request->user() && $request->user()->isBarangayAdmin()) {
                $path = $request->path();
                // barangay_admin can only access registration request routes
                // Check both with and without the 'api/' prefix
                if (str_contains($path, 'registration-requests')) {
                    return $next($request);
                }
            }
            return response()->json(['message' => 'Forbidden — admin access required.'], 403);
        }

        return $next($request);
    }
}
