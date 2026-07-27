# Captures By Capri

Photography portfolio site with a booking workflow: Cal.com handles scheduling,
Stripe handles a deposit and a final invoice, and an admin dashboard drives the
appointment through to photo delivery. Clients are notified by SMS or email
depending on their stated preference.

Self-hosted on a single Proxmox LXC. Previously hosted on Replit with Supabase
providing Postgres, Auth, Storage and two Deno edge functions.

## Architecture

```
                     Caddy (TLS only, automatic ACME)
                                  │
                     api-server  (Express 5, one process)
                     ├── /api/*      REST API
                     ├── /media/*    photo files from MEDIA_DIR
                     ├── /*          the built SPA + history fallback
                     └── node-cron   time-based appointment workflow
                                  │
                     Postgres 17 (loopback)
```

One process serves the API, the images and the SPA. That keeps the admin session
cookie same-origin by construction — no CORS configuration, no cookie-domain
problems — and means one systemd unit to supervise. Caddy exists only to
terminate TLS, which Stripe and Cal.com both require for webhooks.

| Package | What it is |
|---|---|
| `artifacts/api-server` | Express 5 + TypeScript API, Drizzle ORM, node-cron scheduler |
| `artifacts/captures-by-capri` | React 19 + Vite 7 SPA (wouter, Tailwind v4, Framer Motion) |
| `scripts` | Workspace utilities, including `scripts/db/*` |
| `db` | docker-compose Postgres helpers, SQL maintenance scripts |

pnpm workspace. Node 24, pnpm 11 (see `engines` and `.nvmrc`).

## Prerequisites

- Node 24 (`nvm use`)
- pnpm 11 (`corepack enable`)
- Docker, for the local Postgres and pgAdmin

## First run

```bash
pnpm install
cp .env.example .env          # then fill in ADMIN_PASSWORD and SESSION_SECRET
pnpm db:up                    # postgres on :5433, pgadmin on :5050
pnpm db:migrate               # create the schema
pnpm db:seed                  # lookup tables + a few sample photos
pnpm dev                      # api-server :3000, vite :5173
```

Open <http://localhost:5173>. The admin dashboard is at `/admin`; log in with the
`ADMIN_PASSWORD` you set.

Generate a session secret with `openssl rand -hex 32`.

To work with real data instead of seed data, put a production dump in `db/dump/`
and see [`db/README.md`](db/README.md).

Images are served from `MEDIA_DIR` (default `./media`), which mirrors the old
Supabase `Photos` bucket. Until you populate it, image requests 404 harmlessly —
see [Media files](#media-files).

## Running everything with Docker

`docker-compose.yml` also has an `app` service: a container image (built from
the root `Dockerfile`) that runs api-server with `SERVE_STATIC=true`, serving
the API, `/media`, and the built SPA on one port — no separate Vite process.

```bash
cp .env.example .env          # then fill in ADMIN_PASSWORD and SESSION_SECRET
docker compose up -d --build  # postgres, pgadmin, and the app, all in containers
pnpm db:migrate                # schema — still runs from the host, against :5433
pnpm db:seed
```

Open <http://localhost:3000>. This is the same build the LXC eventually runs, so
`NODE_ENV` is always `production` inside the container regardless of `.env` —
which also means the admin session cookie is `secure` and won't persist over
plain `http://localhost`. Use `pnpm dev` (native, not containerized) to test the
admin login locally.

`BASE_PATH` and `CAL_URL` are baked into the SPA bundle at build time, not read
from the container's environment — changing them needs `--build`, not just a
restart. Everything else in `.env` is read at container start, same as `pnpm
dev`. `./media` is bind-mounted in, so it's the same photos either way.

## Environment

Every variable is documented in [`.env.example`](.env.example). One `.env` at the
repo root serves both packages: api-server loads it via `src/env.ts` (dotenv +
zod validation, so a missing or malformed value fails at boot with every problem
listed at once), and `vite.config.ts` loads it separately because Vite reads
`process.env` at config-evaluation time in its own process.

In production, systemd's `EnvironmentFile` wins — dotenv is loaded with
`override: false`.

The ones worth calling out:

| Variable | Notes |
|---|---|
| `ADMIN_PASSWORD` | The only credential. There is no user table. Min 12 chars. |
| `SESSION_SECRET` | Signs the session cookie. Min 32 chars. Rotating it logs the admin out. |
| `CAL_WEBHOOK_SECRET` | Must match the value set in the Cal.com webhook UI. The webhook **fails closed** without it. |
| `SERVE_STATIC` | `true` in production so Express serves the SPA; `false` locally so Vite owns HMR. |
| `ENABLE_SCHEDULER` | `true` only in production. |
| `CRON_SCHEDULE` | **At most once per day.** See [Gotchas](#gotchas). |
| `MEDIA_DIR` | Relative values resolve against the repo root, not the working directory. |

Never put a secret in a Vite `define` — those are inlined into the public bundle.

## Commands

```bash
pnpm dev              # both servers in parallel
pnpm build            # typecheck, then tsc + vite build
pnpm typecheck

pnpm db:up            # start postgres + pgadmin
pnpm db:down
pnpm db:reset         # DESTROY the volume, recreate, migrate, seed
pnpm db:psql
pnpm db:restore       # restore db/dump/<newest>
pnpm db:generate      # generate a migration from schema.ts changes
pnpm db:migrate
pnpm db:studio        # browse data
pnpm db:seed
```

## Database

Full detail in [`db/README.md`](db/README.md). The short version:

Schema lives in `artifacts/api-server/src/db/schema.ts`; migrations are committed
under `artifacts/api-server/drizzle/`.

```bash
# 1. edit src/db/schema.ts
pnpm db:generate     # 2. writes drizzle/NNNN_*.sql
# 3. READ the generated SQL — always
pnpm db:migrate      # 4. apply
```

**Never run `db:push` against production.** It applies a schema diff without
recording a migration, so the history silently diverges. It exists for local
experiments only.

`drizzle/0000_baseline.sql` is deliberately idempotent, so the same `db:migrate`
both builds a fresh database and adopts an existing restored one. If you ever
regenerate it, re-apply the guards.

## API

| Method | Path | Auth |
|---|---|---|
| GET | `/api/healthz` | — |
| GET | `/api/portfolio` | — |
| POST | `/api/admin/login` | password (rate limited) |
| POST | `/api/admin/logout` | — |
| GET | `/api/admin/me` | cookie |
| GET | `/api/admin/appointments?status=…` | cookie |
| GET | `/api/admin/appointments/:id` | cookie |
| PATCH | `/api/admin/appointments/:id/status` | cookie |
| POST | `/api/admin/appointments/:id/{confirm,reject,remind-deposit,send-final-invoice,remind-final-invoice,mark-editing,send-photo-link}` | cookie |
| PATCH | `/api/admin/appointments/:id/set-price` | cookie |
| POST | `/api/webhooks/stripe` | Stripe signature |
| POST | `/api/webhooks/cal` | HMAC-SHA256 signature |
| POST | `/api/jobs/run` | cookie |

Auth is a single shared password exchanged for a signed, httpOnly, `SameSite=Lax`
session cookie whose expiry is inside the signed value — a client cannot extend
its own session.

`/api/webhooks/cal` and `/api/webhooks/stripe` both need the raw request body for
signature verification, so their `express.raw` mounts must stay registered
**before** `express.json()` in `src/app.ts`.

## Media files

Photos live on disk, served from `MEDIA_DIR` at `/media`. They came from the
Supabase `Photos` bucket:

```bash
supabase storage cp -r ss:///Photos ./media --experimental
bash scripts/db/check-media.sh     # verify every photo.url resolves to a file
```

The bucket layout maps 1:1 onto `/media`, so `db/sql/100_rewrite_photo_urls.sql`
is a pure prefix swap.

On the LXC, bind-mount the directory from the host so it can be snapshotted:

```
# /etc/pve/lxc/<vmid>.conf
mp0: /tank/capri/media,mp=/srv/capri/media
```

**This is the only copy of the photos.** Back it up separately from Postgres.

## Deployment

```bash
git clone … /srv/capri/app && cd /srv/capri/app
corepack enable && corepack prepare pnpm@11.2.2 --activate
pnpm install --frozen-lockfile
pnpm build
pnpm db:migrate
```

Install Postgres 17 natively (`apt install postgresql-17` from PGDG) rather than
running Docker inside the container, and leave it on `listen_addresses = 'localhost'`.

systemd unit, with `NODE_ENV=production SERVE_STATIC=true ENABLE_SCHEDULER=true`:

```ini
[Unit]
After=network-online.target postgresql.service
Requires=postgresql.service

[Service]
User=capri
WorkingDirectory=/srv/capri/app/artifacts/api-server
EnvironmentFile=/srv/capri/app/.env
Environment=NODE_ENV=production SERVE_STATIC=true ENABLE_SCHEDULER=true
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/srv/capri/media

[Install]
WantedBy=multi-user.target
```

Caddyfile:

```
capturesbycapri.com, www.capturesbycapri.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Then repoint the **Stripe** webhook to `/api/webhooks/stripe` and the **Cal.com**
webhook to `/api/webhooks/cal` with `CAL_WEBHOOK_SECRET` set.

Back up nightly: `pg_dump -Fc` plus a snapshot of the media directory. Test a
restore before decommissioning anything.

## Gotchas

**`CRON_SCHEDULE` must fire at most once per day.** The reminder windows are each
a full 24 hours wide and nothing records that a reminder was already sent, so an
hourly schedule sends every reminder up to 24 times. Finer resolution needs a
schema change, not a config change. `POST /api/jobs/run` is not idempotent either
— test with the Twilio and Resend keys unset, where both degrade to a
warn-and-skip.

**`appointment.id` is both a serial PK and a Cal.com bookingId sink.** Webhook
rows set the id explicitly, which never advances the sequence, so
`db/sql/110_sync_sequences.sql` is mandatory after any data-only load and
`insertAppointment` fast-forwards the sequence itself. The column must stay
`serial` / `GENERATED BY DEFAULT`; `GENERATED ALWAYS` rejects explicit ids and
Drizzle won't emit `OVERRIDING SYSTEM VALUE`.

**Image filename case.** `media/home/` mixes `.JPG` and `.jpg`. macOS APFS is
case-insensitive so a wrong-case reference works locally and 404s on ext4. Run
`scripts/db/check-media.sh`.

**Express 5 throws on `app.get("*")`** (`TypeError: Missing parameter name` under
path-to-regexp v8) — every SPA-fallback snippet online is written for Express 4.
Use a terminal `app.use`. Relatedly, the `/api` and `/media` 404 handlers must
precede the SPA fallback or they are unreachable and unmatched paths answer 200
with `index.html`.

**Google Fonts `@import url()` must be the first line of `src/index.css`**, before
`@import "tailwindcss"`. CSS requires all `@import` rules to precede other rules,
and Tailwind v4's import expands into rules.

**Don't use `z.coerce.boolean()` for env flags.** `Boolean("false") === true`, so
`SERVE_STATIC=false` would silently enable static serving. `src/env.ts` parses the
literal words.

## History

Migrated off Replit + Supabase in July 2026. The Supabase project was
`sizdhvcsdtmhfkvddxmo` (us-west-2, Postgres 17.6.1.127) — hence the local
Postgres being pinned to 17.6.

The two Deno edge functions became ordinary endpoints:
`cal-booking-webhook` → `POST /api/webhooks/cal` (which also gained the HMAC
verification it never had), and `scheduled-jobs` → `POST /api/jobs/run` plus the
node-cron scheduler. Their original source is at commit `c12773d` under
`supabase/functions/*/lib/bundle.ts` if you need to compare behaviour.
