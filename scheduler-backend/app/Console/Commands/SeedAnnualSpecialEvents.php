<?php

namespace App\Console\Commands;

use Database\Seeders\SpecialEventsSeeder;
use Illuminate\Console\Command;

class SeedAnnualSpecialEvents extends Command
{
    protected $signature = 'events:seed-annual';

    protected $description = 'Create special event reservations for this and next year';

    public function handle(SpecialEventsSeeder $seeder): int
    {
        $seeder->run();

        return self::SUCCESS;
    }
}
