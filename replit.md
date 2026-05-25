# Captures By Capri

A luxury photography portfolio website with photoshoot booking, Cal.com scheduling integration, Twilio SMS notifications, and an admin approval dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/captures-by-capri run dev` — run the frontend (port 24316)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter, TanStack Query, Tailwind CSS, Framer Motion, shadcn/ui
- API: Express 5
- DB: PostgreSQL + Drizzle ORM (Replit built-in)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- SMS: Twilio (raw REST API, no SDK)
- Scheduling: Cal.com embed iframe
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/db/src/schema/gallery.ts` — Gallery images table
- `lib/db/src/schema/bookings.ts` — Bookings table
- `artifacts/api-server/src/routes/gallery.ts` — Gallery CRUD routes
- `artifacts/api-server/src/routes/bookings.ts` — Bookings routes (approve/decline/webhook)
- `artifacts/api-server/src/lib/sms.ts` — Twilio SMS service
- `artifacts/captures-by-capri/src/pages/` — All frontend pages
- `artifacts/captures-by-capri/src/pages/admin/` — Admin dashboard + booking detail

## Architecture decisions

- Twilio is called via raw fetch (no SDK) to keep the bundle lean and avoid ESM issues
- Cal.com is embedded as an iframe — no OAuth needed; webhook at `/api/bookings/webhook/calcom` handles confirmed bookings
- Approve/decline flows send SMS to client via Twilio, then update booking status atomically
- Admin dashboard link is included in every new-booking SMS to admin so approvals are one tap away
- Replit built-in PostgreSQL used instead of Supabase (same PostgreSQL under the hood, better integrated with Replit deploy)

## Product

- **/** — Cinematic landing page with hero, philosophy section, featured works grid, and CTA
- **/portfolio** — Gallery with category filtering and lightbox
- **/book** — Booking inquiry form + Cal.com scheduler embed side by side
- **/admin** — Admin dashboard: stats, full bookings table with status tabs, approve/decline actions
- **/admin/bookings/:id** — Booking detail with all client info and approve/decline buttons

## SMS Flow

1. Client submits booking → admin receives SMS with link to `/admin/bookings/:id`
2. Admin clicks link → views booking detail page → clicks Approve or Decline
3. Client receives SMS confirmation or decline notification with optional reason

## Cal.com Webhook

Set your Cal.com webhook URL to: `https://<your-domain>/api/bookings/webhook/calcom`
Trigger: `BOOKING_CREATED` — this auto-creates a booking record and notifies admin via SMS.

## Required Secrets

- `DATABASE_URL` — Set automatically by Replit
- `TWILIO_ACCOUNT_SID` — Twilio console
- `TWILIO_AUTH_TOKEN` — Twilio console
- `TWILIO_PHONE_NUMBER` — Your Twilio number (e.g. +15550001234)
- `ADMIN_PHONE_NUMBER` — Your personal number for new booking SMS alerts

## Gotchas

- Google Fonts `@import url()` must be the FIRST line in `index.css` (before `@import "tailwindcss"`) — PostCSS errors otherwise
- After any OpenAPI spec change, run codegen before editing routes or frontend
- Cal.com embed uses placeholder username "capri" — update to real Cal.com username before going live
