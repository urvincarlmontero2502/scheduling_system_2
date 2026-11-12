<?php

namespace App\Services;

use App\Models\ActivityLog;
use App\Models\User;

class ActivityLogger
{
    public function record(
        User $actor,
        string $action,
        string $description,
        ?string $subjectType = null,
        int|string|null $subjectId = null,
        array $properties = []
    ): void {
        ActivityLog::create([
            'actor_id' => $actor->user_id,
            'actor_name' => $actor->full_name,
            'actor_role' => $actor->role,
            'action' => $action,
            'subject_type' => $subjectType,
            'subject_id' => $subjectId === null ? null : (string) $subjectId,
            'description' => $description,
            'properties' => $properties ?: null,
            'created_at' => now(),
        ]);
    }
}
