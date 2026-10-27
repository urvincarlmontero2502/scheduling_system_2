# Migrate to Apache — Full Stack (Supabase → Apache + PostgreSQL/MySQL)

## Current Architecture
| Component | Current Host | Target |
|-----------|-------------|--------|
| Frontend (React/Vite SPA) | Vercel (`scheduling-system-2.vercel.app`) | Apache `public/dist/` |
| Backend (Laravel API) | Render.com (`scheduling-system-2.onrender.com`) | Apache + PHP 8.3 |
| Database | Supabase (PostgreSQL) | Apache server (local PostgreSQL) |

## Migration Steps

### 1. Provision Your Apache Server

**On your Ubuntu/Debian server:**

```bash
sudo apt update && sudo apt install -y \
  apache2 libapache2-mod-php php8.3 \
  php8.3-cli php8.3-fpm php8.3-pgsql php8.3-mbstring \
  php8.3-xml php8.3-curl php8.3-gd php8.3-zip \
  php8.3-bcmath php8.3-opcache postgresql postgresql-contrib \
  composer git nodejs npm

sudo a2enmod rewrite headers ssl
sudo systemctl enable apache2 postgresql
sudo systemctl start apache2 postgresql
```

### 2. Set Up PostgreSQL

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE scheduler;
CREATE USER scheduler_user WITH PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE scheduler TO scheduler_user;
ALTER USER scheduler_user CREATEDB;
\q
```

### 3. Export Database from Supabase

**Option A: Using `pg_dump` (requires Supabase connection string)**

```bash
# Get your connection string from Supabase dashboard → Settings → Database
pg_dump "postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres" \
  --no-owner --no-privileges > scheduler_dump.sql
```

**Option B: Using Supabase CLI (recommended)**

```bash
# Install Supabase CLI
npm install -g supabase

# Link your project (need SUPABASE_ACCESS_TOKEN)
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Dump database
supabase db dump --schema 'public' > scheduler_dump.sql
```

### 4. Deploy Backend (Laravel)

```bash
cd /var/www
sudo git clone [your-repo-url] scheduler
sudo chown -R www-data:www-data /var/www/scheduler

cd /var/www/scheduler/scheduler-backend
composer install --optimize-autoloader
```

### 5. Create `.env` (PostgreSQL version)

```bash
cp .env.example .env
```

Edit `.env`:

```env
APP_NAME=Scheduler
APP_ENV=production
APP_KEY=base64:GENERATE_WITH_KEY_COMMAND
APP_DEBUG=false
APP_URL=https://your-domain.com

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=scheduler
DB_USERNAME=scheduler_user
DB_PASSWORD=your_secure_password_here

# Update these for new domain
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
FRONTEND_URL=https://your-domain.com

# Brevo for email (keep existing API key)
MAIL_MAILER=brevo
BREVO_API_KEY=your_brevo_api_key
```

```bash
php artisan key:generate
```

### 6. Import Database

```bash
# Import the dump you created
psql -U scheduler_user -d scheduler -h 127.0.0.1 -W -f /var/www/scheduler/scheduler_dump.sql

# Run any pending migrations
php artisan migrate --force
```

### 7. Build & Deploy Frontend

```bash
cd /var/www/scheduler/scheduler-frontend/scheduler-frontend

# Create production env
echo 'VITE_API_URL=https://your-domain.com/api' > .env.production

npm install
npm run build

# Copy build to Laravel public directory
cp -r dist /var/www/scheduler/scheduler-backend/public/dist
```

### 8. Apache Virtual Host

Create `/etc/apache2/sites-available/scheduler.conf`:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    DocumentRoot /var/www/scheduler/scheduler-backend/public
    <Directory /var/www/scheduler/scheduler-backend/public>
        AllowOverride All
        Require all granted
        RewriteEngine On
        # SPA fallback — serve index.html for non-API routes
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_URI} !^/api
        RewriteCond %{REQUEST_URI} !^/dist
        RewriteRule ^ /index.html [L]
    </Directory>
    ErrorLog ${APACHE_LOG_DIR}/scheduler_error.log
    CustomLog ${APACHE_LOG_DIR}/scheduler_access.log combined
</VirtualHost>
```

```bash
sudo a2ensite scheduler
sudo a2dissite 000-default
sudo systemctl reload apache2
```

### 9. Optimize & Test

```bash
cd /var/www/scheduler/scheduler-backend
php artisan config:cache
php artisan route:cache
php artisan storage:link
```

Test: visit `https://your-domain.com/api/health`

### 10. Transfer Uploaded Assets

Download assets from Supabase storage bucket and upload to server:

```bash
# If using Supabase storage
supabase storage cp -r assets/facilities /var/www/scheduler/scheduler-backend/storage/app/assets/facilities
supabase storage cp -r assets/vehicles /var/www/scheduler/scheduler-backend/storage/app/assets/vehicles
supabase storage cp -r assets/profiles /var/www/scheduler/scheduler-backend/storage/app/assets/profiles
```

### 11. Update Google OAuth

Go to [Google Cloud Console](https://console.cloud.google.com/) → APIs & Credentials:
- **Authorized redirect URI**: `https://your-domain.com/auth/google/callback`
- **Authorized JavaScript origins**: `https://your-domain.com`

### 12. DNS & Cutover

1. Point your domain's A record to the new server's IP
2. Update DNS TTL to 300 seconds beforehand
3. After DNS propagates, decommission Render/Vercel services

## Migration Checklist

- [ ] Server provisioned with Apache + PHP + PostgreSQL
- [ ] Database exported from Supabase
- [ ] Backend deployed, `.env` configured for PostgreSQL
- [ ] Frontend rebuilt with production API URL
- [ ] Apache virtual host configured
- [ ] SSL certificate (Let's Encrypt)
- [ ] `php artisan config:cache` and `route:cache`
- [ ] Uploaded assets transferred from Supabase storage
- [ ] Google OAuth redirect URIs updated
- [ ] DNS A record pointed to new server
- [ ] Smoke test: login, load resources, create booking
- [ ] Old Render/Vercel services decommissioned

## Important Notes

1. **Supabase Row-Level Security (RLS)**: When you export/import, RLS policies come with the dump as part of the schema. If your tables use Supabase RLS, you may need to disable RLS on the local PostgreSQL instance or adapt the policies for local PostgreSQL roles.

2. **Supabase Auth**: If you use Supabase Auth (not just PostgreSQL), you'll need to migrate auth users separately — the Laravel `users` table manages its own auth, so check whether `password_hash` values are compatible.

3. **Environment variables**: The `.env` files for all three services (`.env` on Render, `.env.local` on Vercel) contain secrets — make sure you capture `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `BREVO_API_KEY`, and `APP_KEY` before shutting down old services.

4. **File storage**: The `FILESYSTEM_DISK=assets` config uses the `assets` disk — make sure `storage/app/assets/` is writable by `www-data`.

5. **Database URL**: If you want to keep using Supabase PostgreSQL (instead of local PostgreSQL), you can — just set `DB_CONNECTION=pgsql` and point `DB_HOST` to your Supabase connection string host.

## Rollback Plan

If something goes wrong:
1. Don't shut down Render/Vercel services until you've verified the Apache deployment
2. Keep the Supabase database running until you've confirmed the local PostgreSQL import is intact
3. You can switch DNS back at any time before decommissioning old services
