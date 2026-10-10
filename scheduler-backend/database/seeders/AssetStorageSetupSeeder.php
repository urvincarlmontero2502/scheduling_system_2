<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Storage;

class AssetStorageSetupSeeder extends Seeder
{
    /**
     * Set up the organized asset storage directory structure.
     */
    public function run(): void
    {
        // Create subdirectories on the 'assets' disk (storage/app/public/uploads/)
        $subdirs = ['facilities', 'vehicles', 'profiles', 'branding'];

        foreach ($subdirs as $subdir) {
            Storage::disk('assets')->makeDirectory($subdir);
        }

        $this->command->info('Asset storage directories created: ' . implode(', ', $subdirs));
    }
}
