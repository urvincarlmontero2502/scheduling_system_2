# Facility & Vehicle Scheduler — Frontend

React + Vite frontend for the Web-Based Real-Time Scheduling System, built to
pair with a Laravel + PostgreSQL backend.

## Run it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. API calls to `/api/*` are proxied to
`http://localhost:8000` (your local Laravel server) — see `vite.config.js`.

## What's included

- **Routing** (`react-router-dom`) — login, protected dashboard shell, calendar, bookings, resources
- **Auth** (`src/context/AuthContext.jsx`) — Laravel Sanctum token flow: signs in against `POST /login`, stores the token, attaches it to every request, and clears it on a 401
- **API layer** (`src/api/`) — one axios client + one file of endpoint functions to extend as you build out your Laravel routes
- **Calendar** (`src/pages/Calendar.jsx`) — a real week/time grid, color-coded by booking status
- **Bookings** (`src/pages/Bookings.jsx`) — list + approve/reject actions (visible only to the `admin` role)
- **Role-based nav** — the sidebar in `DashboardLayout.jsx` filters items by `user.role`

Pages currently fall back to placeholder data if the API isn't reachable yet,
so the UI is fully demoable before your backend endpoints exist — you'll see
a small "showing sample data" note whenever that's happening. Remove the
placeholders once your endpoints are live.

## Connecting to your Laravel API

Your backend should expose (adjust names to match what you build):

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/login` | Returns `{ token, user }` |
| POST | `/api/logout` | Revokes the current token |
| GET | `/api/user` | Returns the authenticated user |
| GET | `/api/bookings` | List bookings (supports query params) |
| POST | `/api/bookings` | Create a booking |
| PATCH | `/api/bookings/{id}/status` | Approve/reject a booking |
| GET | `/api/resources` | List facilities/vehicles |

On the Laravel side, install Sanctum and add `EnsureFrontendRequestsAreStateful`
or use token-based auth (simplest for a separately-hosted SPA) — the frontend
here expects a bearer token back from `/login`, not cookie sessions, so token
auth is the more compatible option.

## Building for production

```bash
npm run build
```

Outputs static files to `dist/` — point Apache at this directory (see the
earlier discussion on virtual host config), and set `VITE_API_URL` in a
`.env` file before building if your API is on a different origin.

## Next steps

- Wire `Calendar.jsx` and `Bookings.jsx` fully to your real endpoints (remove placeholder arrays)
- Add a booking-creation form/modal (the "New booking" button is currently a placeholder)
- Add real-time updates via Laravel Echo + WebSockets if you want push updates instead of polling
