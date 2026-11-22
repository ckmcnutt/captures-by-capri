# Captures By Capri

Photography portfolio site. Booking is a Cal.com embed on `/book`; photos are
plain files on disk.

```
Caddy (host, TLS)  ->  api-server (Express 5, one container)
                       ├── /api/portfolio   lists MEDIA_DIR/portfolio
                       ├── /media/*         photo files from MEDIA_DIR
                       └── /*               the built SPA + history fallback
```

| Package | What it is |
|---|---|
| `artifacts/api-server` | Express 5 + TypeScript |
| `artifacts/captures-by-capri` | React 19 + Vite 7 SPA (wouter, Tailwind v4, Framer Motion) |

pnpm workspace. Node 24, pnpm 11 (see `engines` and `.nvmrc`).

## Run locally

```bash
pnpm install
cp .env.example .env
pnpm dev                      # api-server :3000, vite :5173
```

Or the production build in Docker, on <http://localhost:3000>:

```bash
docker compose up -d --build
```

`BASE_PATH` and `CAL_URL` are baked into the SPA bundle at build time —
changing them needs `--build`, not just a restart.

## Photos

Drop files into `MEDIA_DIR` (default `./media`). No deploy needed.

```
media/
├── home/                    hero.JPG, meet_me.JPG, feature1-4 — referenced by
│                            name in src/pages/home.tsx, so replace in place
└── portfolio/
    ├── engagement/          each directory is a category on /portfolio
    │   └── IMG_001.jpg
    └── wedding-day/         label is title-cased: "Wedding Day"
        └── IMG_003.jpg
```

**Filename case matters.** macOS is case-insensitive, the server's ext4 isn't:
a home image saved as `hero.jpg` instead of `hero.JPG` works locally and 404s in
production. Portfolio photos are safe — their URLs come from a directory listing.

On the LXC, bind-mount the directory from the host and back it up — it's the
only copy:

```
# /etc/pve/lxc/<vmid>.conf
mp0: /tank/capri/media,mp=/srv/capri/media
```

and set `HOST_MEDIA_DIR=/srv/capri/media` in `.env`.

## Deployment

```bash
git clone … /srv/capri/app && cd /srv/capri/app
cp .env.example .env          # set HOST_MEDIA_DIR
docker compose up -d --build
```

Caddy on the host:

```
capturesbycapri.com, www.capturesbycapri.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000
}
```

Redeploy with `./deploy.sh` (pulls, rebuilds if anything changed).

## Gotchas

**Express 5 throws on `app.get("*")`** — use a terminal `app.use` for the SPA
fallback. The `/api` and `/media` 404 handlers must precede it or unmatched
paths answer 200 with `index.html`.

**Google Fonts `@import url()` must be the first line of `src/index.css`**,
before `@import "tailwindcss"`.

**Don't use `z.coerce.boolean()` for env flags** — `Boolean("false") === true`.
`src/env.ts` parses the literal words.
