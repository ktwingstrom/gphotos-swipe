# gphotos-swipe

Swipe-review your Google Photos library: right = keep, left = sends it to a "To Delete" album you can empty later from the Google Photos app. Like a dating app, but for photos.

![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss)

> Originally built against Immich; pivoted to the Google Photos Library API. Old Immich code paths (`useImmich`, `auth` store, `vite-env.d.ts` user slots) still hang around but aren't wired into the active routes.

## What it does

A mobile-first SPA for triaging your Google Photos library one photo at a time. Pick a mode, swipe through, build a streak.

**Modes**

| Mode | What you get |
|---|---|
| **Recents** | The last ~90 days |
| **Random** | Paginated + shuffled batches across your whole library, optionally filtered to photos or videos |
| **On this day** | Google Photos memories for today's month/day |
| **By month** | Tap any of the last 36 monthly tiles to review just that month. Completed months get a strikethrough |

**Why "delete" isn't really delete**

The Google Photos Library API doesn't expose a real delete. Instead, the app auto-creates a `To Delete` album on first use and adds left-swiped photos to it. You then open Google Photos, select all, and trash them by hand. The album ID is cached in `localStorage` (`gphotos-to-delete-album-id`).

## Controls

| Action | Gesture / Key | Button |
|---|---|---|
| Keep | Swipe right / `→` | KEEP |
| Delete (→ "To Delete" album) | Swipe left / `←` | DELETE |
| Undo last action | `Ctrl/⌘+Z` or `↑` | ↶ |
| Add to album | `0–9` (configurable) | + |
| Share Google Photos link | — | share icon |

Reviewed asset IDs and stats are persisted in `localStorage` so you don't see the same photo twice across sessions. Daily activity feeds a streak counter on the home screen.

## Configuration

You need a Google OAuth client (Web application) with the Google Photos Library API enabled.

**Required scopes**

- `https://www.googleapis.com/auth/photoslibrary.readonly`
- `https://www.googleapis.com/auth/photoslibrary.appendonly`

**Required env vars**

```bash
VITE_GOOGLE_CLIENT_ID=...
VITE_GOOGLE_CLIENT_SECRET=...
```

These are baked into the bundle at build time, so anyone with the deployed app can read them. **Only deploy this somewhere private** (LAN, Tailscale, password-gated reverse proxy, etc.). Don't ship it to a public URL with a long-lived client secret embedded.

**Authorized redirect URI**

Whatever URL the app is served from, exactly. For local dev: `http://localhost:5173`. For Docker: `https://<your-host>` (must be HTTPS — see below).

### HTTPS is mandatory in production

The PKCE flow uses `crypto.subtle`, which browsers only expose on secure contexts. `localhost` counts as secure for development; raw LAN IPs (`http://192.168.x.x`) do not. For non-localhost deployments, terminate TLS in front of the container — Tailscale serve, Caddy, Nginx Proxy Manager, Cloudflare Tunnel, etc.

## Quickstart

### Local development

```bash
npm install
cp env.example .env   # fill in VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_CLIENT_SECRET
npm run dev
```

Open `http://localhost:5173` and add it as an authorized redirect URI in Google Cloud Console.

### Docker

```bash
cp env.example .env
# edit .env
docker compose up --build
```

App listens on port `2293`. Front it with HTTPS as noted above.

`.env` values are passed as build args and embedded in the compiled bundle — changing them requires a rebuild (`docker compose build`).

### GitHub Pages

A workflow (`.github/workflows/`) builds and deploys to Pages on every push to `main`. URL ends up at `https://<owner>.github.io/<repo>/`. Pages serves HTTPS automatically, so PKCE works out of the box. Note: build args (your Google client ID/secret) need to be configured as GitHub Actions secrets if you go this route, otherwise the deployed app won't have OAuth credentials.

### GHCR container

A second workflow publishes a container image to `ghcr.io/<owner>/<repo>` on push to `main` and on `v*` tags.

## Stored data (localStorage)

| Key | Purpose |
|---|---|
| `gphotos-swipe-auth` | Access token, refresh token, expiry |
| `gphotos-to-delete-album-id` | Cached ID of the auto-created "To Delete" album |
| `gphotos-swipe-reviewed` | Already-reviewed asset IDs + decision |
| `gphotos-swipe-preferences` | Sort order, content filter, hide-completed, album hotkeys, completed months |
| `immich-swipe-stats:<server>:<user>` | Keep/delete counters (legacy key name) |
| `immich-swipe-streak` | Daily activity streak (legacy key name) |
| `immich-swipe-theme`, `immich-swipe-skip-videos` | Carried over from the Immich era |

## Architecture

- `src/stores/googleAuth.ts` — OAuth2 PKCE store. Generates `code_verifier`/`code_challenge` via `crypto.subtle`, exchanges the code for tokens, auto-refreshes, persists to `localStorage`.
- `src/composables/useGooglePhotos.ts` — All Google Photos API calls. Mode loaders (recents/random/on-this-day/by-month), pagination, the "To Delete" album logic, undo history, album CRUD for the picker.
- `src/router/index.ts` — Catches `?code=` on `/` after Google's OAuth redirect, runs `handleOAuthCallback`, and bounces to `/`.
- `src/views/MenuView.vue` — Home screen with mode tiles + monthly tiles + streak + settings sheet.
- `src/views/SwipeView.vue` — Full-screen swipe deck with progress, share, album hotkeys.
- `src/types/googlePhotos.ts` — TypeScript types for the Google Photos API responses.

## Development scripts

- `npm run dev` (Vite, `5173`, `--host`)
- `npm run build` (`vue-tsc -b && vite build`)
- `npm run preview`
- `npm run type-check`
- `npm test` (Vitest)
