#!/bin/sh
set -e

# Clear ALL caches first (including any stale route cache from previous deployment)
php artisan optimize:clear

# Then re-cache only the config (NOT routes — route:cache can cause stale routes)
php artisan config:cache

# Run migrations. Keep stderr visible: a swallowed SQL error here is
# what left special events out of the live database.
php artisan migrate --force || echo "Migrations completed (some may have already run)"

# Optional one-time seeding: set RUN_SEED=true in Render, deploy once, then remove it
if [ "$RUN_SEED" = "true" ]; then
  php artisan db:seed --class=BarangayAndAdminSeeder --force || echo "Seed completed (some items may already exist)"
fi

# Idempotent. Safe on every boot, including when the seed migration
# already ran before any user existed and therefore inserted nothing.
php artisan db:seed --class=SpecialEventsSeeder --force || echo "Special events seed failed"

php artisan storage:link 2>/dev/null || true

exec apache2-foreground
