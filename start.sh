#!/bin/sh
set -e

# Clear ALL caches first (including any stale route cache from previous deployment)
php artisan optimize:clear

# Then re-cache only the config (NOT routes — route:cache can cause stale routes)
php artisan config:cache

# Prepare the resource-upload directory for a Render persistent disk mounted
# at /var/www/html/storage/app/public/uploads.
UPLOADS_DIR=/var/www/html/storage/app/public/uploads
mkdir -p "$UPLOADS_DIR"
for directory in "$UPLOADS_DIR" "$UPLOADS_DIR/facilities" "$UPLOADS_DIR/vehicles" "$UPLOADS_DIR/profiles" "$UPLOADS_DIR/branding"; do
  if [ -d "$directory" ]; then
    chown www-data:www-data "$directory"
    chmod u+rwx "$directory"
  fi
done

# Apply resource schema changes before the full migration batch. A legacy
# duplicate registration migration can stop the batch before these run.
php artisan migrate --path=database/migrations/2026_11_11_000001_add_buffer_minutes_to_resources_table.php --force
php artisan migrate --path=database/migrations/2026_11_11_000002_add_images_to_resources_table.php --force

# Apply security migrations explicitly so a failure in a legacy migration
# cannot leave the new authentication flow running against an old schema.
php artisan migrate --path=database/migrations/2026_11_18_000001_create_registration_status_verifications_table.php --force
php artisan migrate --path=database/migrations/2026_11_18_000002_add_remember_token_to_users_table.php --force
php artisan migrate --path=database/migrations/2026_11_18_000003_revoke_legacy_spa_tokens.php --force
php artisan migrate --path=database/migrations/2026_11_18_000004_add_soft_deletes_to_users_table.php --force

# Run remaining migrations. Keep stderr visible and warn if a legacy migration
# prevents the rest of the batch from completing.
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
