<?php

namespace App\Http\Controllers;

use App\Models\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'search' => ['nullable', 'string', 'max:120'],
            'action' => ['nullable', 'string', 'max:80'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = ActivityLog::query()
            ->where('created_at', '>=', now()->subYear())
            ->when(
                $validated['action'] ?? null,
                fn ($query, $action) => $query->where('action', $action)
            )
            ->when($validated['search'] ?? null, function ($query, $search) {
                $query->where(function ($query) use ($search) {
                    $query->where('actor_name', 'like', "%{$search}%")
                        ->orWhere('description', 'like', "%{$search}%")
                        ->orWhere('subject_id', 'like', "%{$search}%");
                });
            });

        return response()->json(
            $query->orderByDesc('created_at')
                ->orderByDesc('activity_log_id')
                ->paginate(25)
        );
    }
}
