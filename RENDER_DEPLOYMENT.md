# Render deployment

## Configure Google sign-in

The Google OAuth redirect must return to the frontend callback route, which
handles the authorization code before posting it to the Laravel API.

1. In the Render backend service environment, set:

   ```env
   GOOGLE_CLIENT_ID=<Google OAuth client ID>
   GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
   FRONTEND_URL=https://<your-frontend-domain>
   MAIL_LOGO_URL=https://<your-frontend-domain>/jabonga-logo.png
   ```

   Do not add a trailing slash to `FRONTEND_URL`. The backend constructs the
   callback URI as `FRONTEND_URL/auth/google/callback`; `GOOGLE_REDIRECT_URI` is
   no longer used. `MAIL_LOGO_URL` must be a publicly accessible URL so
   recipients' email clients can load the logo.
2. In Google Cloud Console, open **APIs & Services → Credentials**, edit the
   OAuth 2.0 Web client, and add:
   - **Authorized JavaScript origin:** `https://<your-frontend-domain>`
   - **Authorized redirect URI:** `https://<your-frontend-domain>/auth/google/callback`
3. Save the settings and redeploy the backend after updating its environment.
   The frontend callback route must also be deployed.

## Booking reminder emails

The backend sends email reminders for upcoming approved bookings at 9:00 AM
Asia/Manila time. The system admin selects a lead time of 1, 3, or 5 days in
**System Settings → Notifications**. Reminder delivery requires Brevo to be
configured and the database migrations to have run.

SMS is optional and disabled by default. To offer it, configure
`BREVO_SMS_SENDER` in the backend environment with an approved Brevo sender
name, ensure the Brevo account has SMS credits, and enable **Also send SMS
reminders through Brevo** in System Settings. SMS uses the booking's Philippine
mobile number; only valid Philippine mobile numbers are sent. Email remains
enabled. Provider charges/credits apply to each SMS.

Laravel's scheduler must be invoked once per minute for the daily reminder
schedule to run. In Render, create a **Cron Job** using the same repository and
backend root directory as the web service:

- **Schedule:** `* * * * *`
- **Command:** `php artisan schedule:run`
- Use the same database, mail, app-key, and other required environment
  variables as the backend web service.

Without this cron job, saving the setting works, but automatic reminders will
not be sent.

## Store uploaded images in Supabase Storage

Render's free service filesystem is ephemeral. Store uploads in Supabase Storage
instead of the backend container's local filesystem:

1. In Supabase Storage, create a bucket for app uploads and make it **public** so
   the frontend can display its images.
2. In the bucket's S3 settings, create an S3 access key and secret. Do not use
   the Supabase `service_role` or `anon` key for these settings.
3. In the Render backend service's environment, set:

   ```env
   ASSETS_DRIVER=s3
   SUPABASE_S3_ACCESS_KEY_ID=<S3 access key>
   SUPABASE_S3_SECRET_ACCESS_KEY=<S3 secret key>
   SUPABASE_S3_REGION=us-east-1
   SUPABASE_S3_BUCKET=<bucket name>
   SUPABASE_S3_ENDPOINT=https://<project-ref>.supabase.co/storage/v1/s3
   SUPABASE_STORAGE_PUBLIC_URL=https://<project-ref>.supabase.co/storage/v1/object/public/<bucket name>
   SUPABASE_S3_USE_PATH_STYLE_ENDPOINT=true
   ```

4. Save the environment settings and redeploy the backend.

The database continues to store image paths such as `facilities/<filename>`; the
Laravel `assets` disk now reads and writes those paths in the Supabase bucket.
Files previously uploaded to Render's local filesystem are not copied
automatically. Re-upload any existing images that are not already in the
Supabase bucket.
