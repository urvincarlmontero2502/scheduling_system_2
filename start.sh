#!/bin/sh
set -e

php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
php artisan migrate --force

# Optional one-time seeding: set RUN_SEED=true in Render, deploy once, then remove it
if [ "$RUN_SEED" = "true" ]; then
  php artisan db:seed --class=BarangayAndAdminSeeder --force
fi

php artisan storage:link 2>/dev/null || true

exec apache2-foreground
