# Render deployment

## Persist uploaded resource images

The Laravel `assets` disk stores files under
`scheduler-backend/storage/app/public/uploads`. Render's container filesystem is
ephemeral, so attach a persistent disk to the backend web service:

1. In Render, open the backend service and add a persistent disk.
2. Set its mount path to `/var/www/html/storage/app/public/uploads`.
3. Choose a size appropriate for your image uploads and save the disk.
4. Redeploy the backend service.

The container startup script prepares the mounted directory and its existing
resource-image subdirectories for Laravel's `www-data` user. Image URLs continue
to use the existing `/storage/uploads/...` path.

Images uploaded before the disk was attached are not automatically copied to
the new disk. If those files are still available, copy them into the mounted
disk's `facilities` or `vehicles` directory before relying on the new storage.
Otherwise, upload them again after deployment. The resource records retain
their stored image paths.
