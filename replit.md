# Captures By Capri

A luxury photography portfolio website. Scheduling is handled entirely through Cal.com — no backend or database required.

## Run & Operate

- `pnpm --filter @workspace/captures-by-capri run dev` — run the frontend (port 24316)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter, Tailwind CSS, Framer Motion, shadcn/ui
- No backend, no database — pure static site

## Where things live

- `artifacts/captures-by-capri/src/pages/` — All frontend pages
- `artifacts/captures-by-capri/src/pages/home.tsx` — Landing page
- `artifacts/captures-by-capri/src/pages/portfolio.tsx` — Gallery with lightbox
- `artifacts/captures-by-capri/src/pages/book.tsx` — Cal.com scheduling embed

## Product

- **/** — Cinematic landing page with hero, philosophy section, and CTA
- **/portfolio** — Gallery with category filtering and lightbox
- **/book** — Cal.com scheduler embed with "What to Expect" and session type info

## Environment Variables

- `CAL_URL` — Cal.com booking URL (default: `https://cal.com/capturesbycapri/appointment`)

## Gotchas

- Google Fonts `@import url()` must be the FIRST line in `index.css` (before `@import "tailwindcss"`) — PostCSS errors otherwise
- Cal.com embed URL is set via `CAL_URL` env var in `vite.config.ts`; default is `https://cal.com/capturesbycapri/appointment`
