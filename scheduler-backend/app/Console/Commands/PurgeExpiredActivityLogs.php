<?php

namespace App\Console\Commands;

use App\Models\ActivityLog;
use Illuminate\Console\Command;

class PurgeExpiredActivityLogs extends Command
{
    protected $signature = 'activity-logs:purge-expired';

    protected $description = 'Delete activity logs older than one year';

    public function handle(): int
    {
        $deleted = ActivityLog::where('created_at', '<', now()->subYear())->delete();

        $this->info("Deleted {$deleted} expired activity logs.");

        return self::SUCCESS;
    }
}
