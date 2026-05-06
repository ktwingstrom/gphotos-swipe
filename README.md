# Immich Swipe

Swipe-review your Immich library: right = keep, left = trash. Like a dating app, but for photos (and videos).

![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?logo=vue.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.x-06B6D4?logo=tailwindcss)

> Briefly pivoted to Google Photos in early 2026. Reverted after Google's March 2025 Photos Library API restrictions made third-party library browsing impossible. Some commit history reflects that detour. The repo dir is still named `gphotos-swipe`; the project name is `immich-swipe`.

## What it does

A mobile-first SPA for triaging your Immich library one asset at a time. Pick a mode, swipe through, build a streak.

**Modes**

| Mode | What you get |
|---|---|
| **Recents** | The last 90 days, newest first |
| **Random** | Random unreviewed assets, optionally filtered to photos or videos |
| **On this day** | Immich's `on_this_day` memories for today |
| **Duplicates** | Everything in Immich's duplicate-detection results, so you can pick favorites and trash the rest |
| **By month** | Tap any monthly tile (real counts from Immich's `/timeline/buckets`) to review just that month. Completed months get a strikethrough |

**"Delete" = Immich trash**

Left-swipe calls `DELETE /assets` with `force: false`, which moves the asset to Immich's trash (default 30-day retention before permanent purge — configurable in Immich admin). Undo within the swipe session calls `POST /trash/restore/assets` and brings it back. Empty trash from Immich's UI when you're satisfied.

## Controls

| Action | Gesture / Key | Button |
|---|---|---|
| Keep | Swipe right / `→` | KEEP |
| Delete (→ trash) | Swipe left / `←` | DELETE |
| Undo last action | `Ctrl/⌘+Z` or `↑` | ↶ |
| Favorite | `F` | ♡ |
| Add to album | `0–9` (configurable) | + |
| Open in Immich | — | ↗ |

Reviewed asset IDs and stats are persisted in `localStorage` keyed by `<server>:<user>`, so each Immich account has its own independent decision history. Daily activity feeds a streak counter on the home screen.

## Configuration

**Required:** an Immich API key per user. Generate one in Immich under **Account → API Keys**. Each key is scoped to one user, so each person gets their own swipe deck of just their photos.

**Minimum API key permissions:** `asset.read`, `asset.delete`. For the album picker, favorites, duplicates, and memories: also grant `asset.update`, `album.read`, `album.update`, `memory.read`, `duplicate.read`.

### Build-time `.env` (multi-user, recommended for self-hosted)

```bash
VITE_SERVER_URL=https://immich.example.com
VITE_USER_1_NAME=Kevin
VITE_USER_1_API_KEY=...
VITE_USER_2_NAME=Partner
VITE_USER_2_API_KEY=...
```

Behavior:
- 1 user → auto-login
- >1 users → user-select screen at `/select-user`
- no `.env` → manual login form at `/login`, stored in `localStorage` under `immich-swipe-config`

`VITE_*` vars are baked into the bundle at build time. Anyone with access to the deployed JS can read them — only deploy on a private network (LAN, Tailscale, password-gated reverse proxy). For public-ish deployments, omit `.env` and have each person log in manually.

### Slot count

User slots are wired up to `VITE_USER_5_*` in `src/vite-env.d.ts`, `Dockerfile`, and `docker-compose.yml`. To go beyond 5, widen those three files.

## API / CORS / Proxy

The browser talks to Immich's API with the `x-api-key` header. Two ways to make that work:

### Option A: same-origin via the bundled nginx proxy (recommended)

Set `VITE_SERVER_URL` to this app's own origin (no path), e.g. `http://192.168.1.50:2293`. The bundled `nginx.conf` exposes a `/api/` location that forwards to `http://immich_server:2283/api/` on the shared Docker network. All API calls and image fetches stay same-origin → no CORS, no preflights.

For this to work, the immich-swipe container must share a Docker network with the Immich container. The bundled `docker-compose.yml` does this by joining the external `immich_default` network (which Immich's official compose creates). If your Immich service is named differently, edit `nginx.conf` before building.

### Option B: direct CORS

Point `VITE_SERVER_URL` at Immich directly (`https://immich.example.com`) and configure CORS on Immich's reverse proxy:

```nginx
add_header 'Access-Control-Allow-Origin' '*' always;
add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, PATCH, DELETE, OPTIONS' always;
add_header 'Access-Control-Allow-Headers' 'X-Api-Key, User-Agent, Content-Type, Authorization, Range, Accept' always;
add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range, Accept-Ranges' always;
if ($request_method = OPTIONS) { return 204; }
```

In this mode you can drop the `networks:` block from `docker-compose.yml` since the container doesn't need to talk to Immich over Docker DNS. See also: https://docs.immich.app/administration/reverse-proxy/

## Quickstart

### Local development

```bash
npm install
cp env.example .env   # set VITE_SERVER_URL + at least one VITE_USER_*
npm run dev
```

Open `http://localhost:5173`.

### Docker

```bash
cp env.example .env
# edit .env
docker compose up --build
```

Listens on port `2293`. `.env` values are baked in at build time — changing `.env` requires `docker compose build`.

### GitHub Pages

`.github/workflows/pages.yml` builds and deploys to Pages on every push to `main`. URL: `https://<owner>.github.io/<repo>/`. Pages serves HTTPS automatically. Note: build args are not configured in the workflow, so the deployed Pages build has no embedded credentials — users authenticate via the manual login form.

### GHCR container

`.github/workflows/publish-ghcr.yml` publishes `ghcr.io/<owner>/<repo>` on push to `main` and `v*` tags. Same caveat as Pages: no build-time credentials in the workflow, so manual login only on that image.

## Stored data (localStorage)

| Key | Purpose |
|---|---|
| `immich-swipe-config` | Manual-login server URL + API key |
| `immich-swipe-theme` | Dark/light pref |
| `immich-swipe-skip-videos` | Skip videos toggle |
| `immich-swipe-stats:<server>:<user>` | Keep/delete counters per account |
| `immich-swipe-reviewed:<server>:<user>` | Reviewed asset IDs + decision per account |
| `immich-swipe-streak` | Daily activity streak |
| `gphotos-swipe-preferences` | Sort order, content filter, hide-completed, album hotkeys, completed months *(legacy key name from the GP detour — preferences live here, not under `immich-swipe-preferences`)* |

## Architecture

- `src/stores/auth.ts` — Server URL + API key store. Parses `VITE_USER_*` slots, supports manual login, persists to localStorage.
- `src/composables/useImmich.ts` — All Immich API calls. Mode loaders (recents/random/on-this-day/duplicates/by-month), pagination, trash + restore, favorites, album CRUD.
- `src/router/index.ts` — Auth gate: routes through `/select-user` for multi-user `.env`, `/login` otherwise.
- `src/views/MenuView.vue` — Home screen: mode tiles + month tiles + streak + settings sheet.
- `src/views/SwipeView.vue` — Full-screen swipe deck with progress, favorite, share-to-Immich, album hotkeys.
- `src/components/SwipeCard.vue` — Fetches images/videos as blobs with auth headers, renders via `URL.createObjectURL`.
- `src/types/immich.ts` — TypeScript types for Immich API responses.

## Development scripts

- `npm run dev` (Vite, `5173`, `--host`)
- `npm run build` (`vue-tsc -b && vite build`)
- `npm run preview`
- `npm run type-check`
- `npm test` (Vitest — currently broken on `localStorage` setup, unrelated to features)
