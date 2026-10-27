# Apache Deployment Guide

## Overview

The scheduling system has two parts:
1. **Frontend**: React + Vite SPA (static build)
2. **Backend**: Laravel 13 API (PHP 8.3+)

To host both on a single Apache server, the frontend build output is placed inside the Laravel project's `public/` directory.

## Prerequisites

- Apache 2.4+ with `mod_rewrite`, `mod_ssl`, `mod_headers`
- PHP 8.3+ with extensions: `mbstring`, `pdo`, `pdo_mysql` (or `pdo_pgsql`), `openssl`, `json`, `fileinfo`, `tokenizer`, `ctype`, `xml`, `cURL`, `gd` or `imagick`
- Composer
- Node.js 20+ (for building frontend)
- MySQL 8+ or PostgreSQL 12+ (for database)

## Step 1: Server Setup

### Install Apache, PHP, and extensions

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install apache2 libapache2-mod-php php php-cli php-fpm php-mysql php-mbstring php-xml php-curl php-gd php-zip php-bcmath php-opcache php-imagick unzip git

# Enable Apache modules
sudo a2enmod rewrite headers ssl

# Restart Apache
sudo systemctl restart apache2
```

### Install Composer and Node.js

```bash
# Composer
php -r "copy('https://getcomposer.org/installer', 'composer-setup.php');"
php composer-setup.php --install-dir=/usr/local/bin --filename=composer
php -r "unlink('composer-setup.php');"

# Node.js (using NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## Step 2: Database Setup

### Create MySQL database and user

```bash
sudo mysql -u root -p
```

```sql
CREATE DATABASE scheduler CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'scheduler_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';
GRANT ALL PRIVILEGES ON scheduler.* TO 'scheduler_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

## Step 3: Deploy Backend (Laravel)

### Clone the project

```bash
cd /var/www
sudo git clone https://github.com/your-repo/scheduling_system.git scheduler
sudo chown -R www-data:www-data /var/www/scheduler
sudo chmod -R 755 /var/www/scheduler
```

### Install PHP dependencies

```bash
cd /var/www/scheduler/scheduler-backend
composer install --optimize-autoloader --no-dev
```

### Create `.env` file

```bash
cd /var/www/scheduler/scheduler-backend
cp .env.example .env
```

Edit `.env`:

```env
APP_NAME="Scheduler"
APP_ENV=production
APP_KEY=base64:GENERATED_KEY_HERE
APP_DEBUG=false
APP_URL=https://your-domain.com

APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

APP_MAINTENANCE_DRIVER=file

BCRYPT_ROUNDS=12
LOG_CHANNEL=stack
LOG_LEVEL=info

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=scheduler
DB_USERNAME=scheduler_user
DB_PASSWORD=your_secure_password_here

SESSION_DRIVER=database
SESSION_LIFETIME=120
SESSION_ENCRYPT=false
SESSION_PATH=/
SESSION_DOMAIN=your-domain.com

BROADCAST_CONNECTION=log
FILESYSTEM_DISK=assets
QUEUE_CONNECTION=database
CACHE_STORE=database

# Mail (Brevo HTTP API recommended for production)
MAIL_MAILER=brevo
MAIL_FROM_ADDRESS=noreply@your-domain.com
MAIL_FROM_NAME="${APP_NAME}"
BREVO_API_KEY=your_brevo_api_key_here

# Google OAuth — UPDATE THIS to your new domain
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://your-domain.com/auth/google/callback
FRONTEND_URL=https://your-domain.com

# Filesystem
FILESYSTEM_DISK=assets
```

Generate app key:

```bash
php artisan key:generate
```

### Run migrations

```bash
php artisan migrate --force
```

### Set storage and bootstrap permissions

```bash
cd /var/www/scheduler/scheduler-backend
sudo find storage bootstrap/cache -type f -exec chmod 644 {} \;
sudo find storage bootstrap/cache -type d -exec chmod 755 {} \;
sudo chown -R www-data:www-data storage bootstrap/cache
```

## Step 4: Build Frontend

```bash
cd /var/www/scheduler/scheduler-frontend/scheduler-frontend
npm install
npm run build
```

The build output goes to `dist/`. Copy it into Laravel's `public/` directory:

```bash
cd /var/www/scheduler/scheduler-backend
rm -rf public/dist
cp -r /var/www/scheduler/scheduler-frontend/scheduler-frontend/dist public/dist
```

### Update frontend `.env.production`

Create or update `scheduler-frontend/scheduler-frontend/.env.production`:

```env
VITE_API_URL=https://your-domain.com/api
```

### Rebuild with production API URL

```bash
cd /var/www/scheduler/scheduler-frontend/scheduler-frontend
VITE_API_URL=https://your-domain.com/api npm run build
cp -r dist ../scheduler-backend/public/dist
```

## Step 5: Apache Virtual Host Configuration

Create `/etc/apache2/sites-available/scheduler.conf`:

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    DocumentRoot /var/www/scheduler/scheduler-backend/public

    # Redirect HTTP to HTTPS
    RewriteEngine On
    RewriteCond %{HTTPS} off
    RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [R=301,L]
</VirtualHost>

<VirtualHost *:443>
    ServerName your-domain.com
    ServerAlias www.your-domain.com
    DocumentRoot /var/www/scheduler/scheduler-backend/public

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384
    SSLHonorCipherOrder on

    <Directory /var/www/scheduler/scheduler-backend/public>
        AllowOverride All
        Require all granted
        # Serve frontend build from /dist/ for SPA routes
        RewriteEngine On

        # Handle SPA fallback — all non-API routes serve index.html
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_URI} !^/api
        RewriteCond %{REQUEST_URI} !^/storage
        RewriteRule ^ /index.html [L]
    </Directory>

    # Security headers
    Header always set X-Content-Type-Options nosniff
    Header always set X-Frame-Options SAMEORIGIN
    Header always set X-XSS-Protection "1; mode=block"
    Header always set Referrer-Policy "strict-origin-when-cross-origin"

    # CORS for SPA API calls (same domain — usually not needed)
    # But include for development convenience
    Header always set Access-Control-Allow-Origin "%{HTTP_ORIGIN}s" env=HTTP_ORIGIN
    Header always set Access-Control-Allow-Credentials "true"

    # Logging
    ErrorLog ${APACHE_LOG_DIR}/scheduler_error.log
    CustomLog ${APACHE_LOG_DIR}/scheduler_access.log combined
</VirtualHost>
```

Enable the site:

```bash
sudo a2ensite scheduler
sudo a2dissite 000-default
sudo systemctl reload apache2
```

## Step 6: SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-apache
sudo certbot --apache -d your-domain.com -d www.your-domain.com
```

## Step 7: Optimize for Production

```bash
cd /var/www/scheduler/scheduler-backend
php artisan config:cache
php artisan route:cache
php artisan view:clear
php artisan event:cache
```

## Step 8: Cron Job (for scheduled tasks)

```bash
sudo crontab -u www-data -e
```

Add:

```
* * * * * /usr/bin/php /var/www/scheduler/scheduler-backend/artisan schedule run >> /dev/null 2>&1
```

## Step 9: Storage Symlink

```bash
php artisan storage:link
```

## Migration from Vercel/Render

### Before switching, ensure:
1. All uploaded assets are transferred from the old storage to the new server's `storage/app/assets/` directory
2. The database is migrated (export from Supabase/Render MySQL, import to new server)
3. Google OAuth credentials are updated in the new `.env` with the new redirect URI
4. Email service (Brevo) API key is configured
5. DNS is pointed to the new server before or after deployment (DNS TTL will affect downtime)

### Update Google OAuth:
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Navigate to APIs & Credentials → OAuth 2.0 Client IDs
- Update the **Authorized redirect URI** to: `https://your-domain.com/auth/google/callback`
- Update **Authorized JavaScript origins** to: `https://your-domain.com`

## Verification

After deployment:
1. Visit `https://your-domain.com` — should show the login page
2. Visit `https://your-domain.com/api/health` — should return `{"status":"ok"}`
3. Check `https://your-domain.com/api/user` with a Bearer token — should return user data
4. Check browser dev tools → Network → verify API calls go to the same origin

## Troubleshooting

- **500 Internal Server Error**: Check Apache error log at `/var/log/apache2/scheduler_error.log`; ensure `storage/` and `bootstrap/cache/` are writable by `www-data`
- **404 on API routes**: Ensure `.htaccess` exists in `public/` and `AllowOverride All` is set
- **Storage uploads not accessible**: Run `php artisan storage:link` and verify Apache can read the `storage/` directory
- **CORS errors**: With same-domain deployment, CORS should not be an issue. If using subdomains, update `cors.php` config.
