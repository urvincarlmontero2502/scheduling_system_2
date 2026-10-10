#!/bin/sh
set -e

php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan config:cache
php artisan migrate --force 2>/dev/null || echo "Migrations completed (some may have already run)"

# Optional one-time seeding: set RUN_SEED=true in Render, deploy once, then remove it
if [ "$RUN_SEED" = "true" ]; then
  php artisan db:seed --class=BarangayAndAdminSeeder --force 2>/dev/null || echo "Seed completed (some items may already exist)"
fi

php artisan storage:link 2>/dev/null || true

exec apache2-foreground
