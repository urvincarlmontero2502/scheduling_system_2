# Local Development Setup

## Prerequisites

- **PHP 8.3+** with extensions: `pdo_pgsql`, `mbstring`, `openssl`, `json`, `fileinfo`, `tokenizer`, `ctype`, `xml`, `curl`, `gd` or `imagick`
- **Composer** (PHP dependency manager)
- **Node.js 20+** and **npm**
- **Supabase account** (already have one — database is already hosted there)
- **Google Cloud OAuth credentials** (for Google Sign-In)

> **Note**: You don't need PostgreSQL installed locally — the backend will connect directly to your Supabase-hosted PostgreSQL database.

## Step 1: Install PHP

If you don't have PHP on your local machine:

### Windows (using XAMPP/Scoop)
```powershell
# Using Scoop
scoop install php

# Or download XAMPP from https://www.apachefriends.org/
```

### macOS
```bash
brew install php@8.3
```

### Ubuntu/Debian
```bash
sudo apt install php8.3 php8.3-cli php8.3-pgsql php8.3-mbstring php8.3-xml php8.3-curl php8.3-gd php8.3-zip php8.3-bcmath
```

Verify:
```bash
php -v    # Should show PHP 8.3+
php -m    # Should include pdo_pgsql, mbstring, etc.
```

## Step 2: Backend Setup (Laravel)

```bash
cd scheduler-backend

# Install PHP dependencies (if not already installed)
composer install

# The .env is already configured for local development
# It connects to Supabase PostgreSQL — just fill in your credentials

# Edit .env with your Supabase credentials:
#   DB_HOST, DB_USERNAME, DB_PASSWORD (from Supabase Dashboard → Settings → Database)
#   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET (from Google Cloud Console)

# Generate app key (if APP_KEY is empty)
php artisan key:generate

# Run migrations (your Supabase DB already has tables, but this ensures sync)
php artisan migrate

# Start the dev server
php artisan serve
```

The backend will run at `http://localhost:8000`

## Step 3: Frontend Setup (React)

```bash
cd scheduler-frontend/scheduler-frontend

# Install dependencies (if not already installed)
npm install

# The .env.development is already configured:
# VITE_API_URL=http://127.0.0.1:8000/api
# Vite proxy forwards /api to your local Laravel backend

# Start the dev server
npm run dev
```

The frontend will run at `http://localhost:5173`

## Step 4: Google OAuth Configuration

For local development, add these redirect URIs in [Google Cloud Console](https://console.cloud.google.com/):

- `http://localhost:8000/auth/google/callback`
- `http://localhost:5173` (Authorized JavaScript origin)

## Step 5: Access the Application

1. Open `http://localhost:5173` in your browser
2. You should see the login page
3. Sign in with Google or use the form login
4. The frontend will proxy API requests to `http://localhost:8000/api/`

## Troubleshooting

### "Class 'PDO' not found"
Install the PHP PostgreSQL extension:
- Windows: Uncomment `extension=pdo_pgsql` in `php.ini`
- macOS: `brew install php--pgsql`
- Ubuntu: `sudo apt install php8.3-pgsql`

### "SQLSTATE[08006]" connection errors
1. Verify your Supabase database password in `.env` (`DB_PASSWORD`)
2. Check that your IP is allowed in Supabase → Settings → Database → Connection pooler → Configurability
3. Try `DB_SSLMODE=require` (already set in `.env`)

### Frontend can't connect to backend
- Check the Vite proxy in `vite.config.js` — it should forward `/api` to `http://127.0.0.1:8000`
- The frontend `.env.development` has `VITE_API_URL=http://127.0.0.1:8000/api`

### Google OAuth not working
- Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are in `.env`
- Verify the redirect URI in Google Cloud Console matches `.env`
- Check that `GOOGLE_REDIRECT_URI=http://localhost:8000/auth/google/callback`

### Already have PHP installed but missing extensions
```bash
# Check what PHP sees
php -m | grep -i pdo
php --ini    # Shows which php.ini is loaded
```

## Environment Files Overview

| File | Purpose |
|------|---------|
| `scheduler-backend/.env` | Backend config (PostgreSQL → Supabase, OAuth, mail) |
| `scheduler-backend/.env.example` | Template with all possible options |
| `scheduler-frontend/scheduler-frontend/.env.development` | Frontend dev mode (points to localhost:8000) |
| `scheduler-frontend/scheduler-frontend/.env.example` | Frontend template (points to production API) |

## Architecture (Local)

```
Browser (localhost:5173)
  │
  │  Proxy: /api/* → localhost:8000/api/*
  ▼
Vite Dev Server (localhost:5173)
  │
  │  HTTP requests
  ▼
Laravel Backend (localhost:8000)
  │
  │  PostgreSQL connection (via Supabase)
  ▼
Supabase PostgreSQL Database (Supabase.io)
```
