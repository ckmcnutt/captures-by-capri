---
name: Supabase project details
description: Project ID, API URL, and migration history for the captures-by-capri Supabase project
---

## Project

- **Name**: captures-by-capri
- **Project ID / ref**: `sizdhvcsdtmhfkvddxmo`
- **API URL**: `https://sizdhvcsdtmhfkvddxmo.supabase.co`
- **Region**: us-west-2

**Why:** The SUPABASE_URL secret must be the project API URL (above), NOT the Supabase dashboard URL (`https://supabase.com/dashboard/...`). The user initially set it to the dashboard URL which caused 500 errors from the API server.

**How to apply:** When requesting or verifying SUPABASE_URL, confirm it matches `https://sizdhvcsdtmhfkvddxmo.supabase.co`.

## Migrations applied

- `add_appointment_columns` — adds `cal_booking_uid`, `stripe_deposit_invoice_id`, `stripe_final_invoice_id`, `final_invoice_amount`, `photo_delivery_url` to `appointment` table. Applied via MCP and also written to `supabase/migrations/20260530000000_add_appointment_columns.sql`.
