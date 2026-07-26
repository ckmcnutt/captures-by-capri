-- Baseline schema for captures-by-capri.
--
-- INTENTIONALLY IDEMPOTENT. This migration has to serve two different starting
-- points:
--
--   1. A fresh local/CI database, where it creates everything.
--   2. The production database restored from the Supabase pg_dump, where the
--      tables already exist and this must be a safe no-op that simply records
--      itself in drizzle.__drizzle_migrations.
--
-- That is why every statement is guarded. The alternative -- hand-inserting a row
-- with the SHA-256 that drizzle's readMigrationFiles() computes over this file --
-- is silently invalidated by any whitespace change, so it is avoided.
--
-- If you ever regenerate this file with `db:generate`, RE-APPLY THESE GUARDS.
-- Later migrations do not need them: they only ever run against a database that
-- already has this baseline recorded.

CREATE TABLE IF NOT EXISTS "appointment" (
	-- serial, not GENERATED ALWAYS: the Cal.com webhook inserts an explicit id
	-- (the Cal bookingId), which an ALWAYS identity column would reject outright.
	"id" serial PRIMARY KEY NOT NULL,
	"aesthetic" text NOT NULL,
	"cal_booking_uid" text,
	"category_id" integer NOT NULL,
	"customer_id" integer,
	"status_id" integer,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"customer_notes" text,
	"internal_notes" text,
	"stripe_deposit_invoice_id" text,
	"stripe_deposit_url" text,
	"stripe_final_invoice_id" text,
	"stripe_final_url" text,
	"final_invoice_amount" numeric(10, 2),
	"photo_delivery_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "appointment_status" (
	"id" serial PRIMARY KEY NOT NULL,
	"status_name" text NOT NULL,
	"status_desc" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_name" text NOT NULL,
	"category_desc" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer" (
	"id" serial PRIMARY KEY NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email_address" text NOT NULL,
	"phone_number" text NOT NULL,
	"preferred_contact_method" text DEFAULT 'email' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "photo" (
	"id" serial PRIMARY KEY NOT NULL,
	"url" text NOT NULL,
	"title" text,
	"category_id" integer NOT NULL,
	"appointment_id" integer,
	"featured_homepage" boolean DEFAULT false NOT NULL,
	"featured_portfolio" boolean DEFAULT false NOT NULL,
	"display_order_homepage" integer,
	"display_order_portfolio" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Constraint names keep the original capital-A forms from the Supabase database,
-- so a future `db:generate` doesn't try to rename every one of them.
DO $$ BEGIN
	ALTER TABLE "appointment" ADD CONSTRAINT "Appointment_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "appointment" ADD CONSTRAINT "Appointment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "appointment" ADD CONSTRAINT "Appointment_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "public"."appointment_status"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "photo" ADD CONSTRAINT "Photo_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "photo" ADD CONSTRAINT "Photo_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointment"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_stripe_deposit_invoice_idx" ON "appointment" USING btree ("stripe_deposit_invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_stripe_final_invoice_idx" ON "appointment" USING btree ("stripe_final_invoice_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "appointment_cal_booking_uid_idx" ON "appointment" USING btree ("cal_booking_uid");--> statement-breakpoint
-- This unique index will FAIL against production data if two customer rows share
-- an email case-insensitively. `bash scripts/db/inspect.sh` reports duplicates;
-- resolve them before applying to the real database.
CREATE UNIQUE INDEX IF NOT EXISTS "customer_email_lower_uniq" ON "customer" USING btree (lower("email_address"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "photo_featured_portfolio_idx" ON "photo" USING btree ("featured_portfolio");
