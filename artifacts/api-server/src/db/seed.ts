/**
 * Seed the lookup tables so a freshly migrated database is usable without the
 * production dump. Idempotent — safe to re-run.
 *
 * Only reference data lives here. Real appointments and customers come from
 * db/seed/data.sql (extracted from a dump) or from actual bookings.
 *
 * Run with: pnpm db:seed
 */
import "../env";
import { sql } from "drizzle-orm";
import { closeDb, db } from "./client";
import { logger } from "../lib/logger";
import { admin_settings, appointment_status, category, pricing_config } from "./schema";
import { STATUS } from "../repositories/status";

/**
 * Status ids are pinned to the values the production database uses, because the
 * old Supabase edge function hardcoded 2 = canceled and 12 = rejected. Keeping
 * the numbering identical means a dev database behaves like production even for
 * code paths that predate the name-based lookup.
 */
const STATUSES: Array<{ id: number; status_name: string; status_desc: string }> =
  [
    { id: 1, status_name: STATUS.requested, status_desc: "Booking submitted via Cal.com, awaiting review" },
    { id: 2, status_name: STATUS.canceled, status_desc: "Canceled by the client or automatically" },
    { id: 3, status_name: STATUS.confirmed, status_desc: "Confirmed after deposit payment" },
    { id: 4, status_name: STATUS.depositRequested, status_desc: "Deposit payment link sent" },
    { id: 5, status_name: STATUS.depositPaid, status_desc: "Deposit received" },
    { id: 6, status_name: STATUS.invoiceSent, status_desc: "Final invoice sent" },
    { id: 7, status_name: STATUS.invoicePaid, status_desc: "Final invoice paid" },
    { id: 8, status_name: STATUS.editing, status_desc: "Session shot, photos being edited" },
    { id: 9, status_name: STATUS.released, status_desc: "Gallery link delivered to the client" },
    { id: 10, status_name: STATUS.complete, status_desc: "Fully complete" },
    { id: 12, status_name: STATUS.rejected, status_desc: "Request declined by the photographer" },
  ];

const CATEGORIES: Array<{ id: number; category_name: string; category_desc: string }> =
  [
    { id: 1, category_name: "Portrait", category_desc: "Individual portrait sessions" },
    { id: 2, category_name: "Family", category_desc: "Family group sessions" },
    { id: 3, category_name: "Couple", category_desc: "Couples sessions" },
    { id: 4, category_name: "Engagement", category_desc: "Engagement sessions" },
    { id: 5, category_name: "Event", category_desc: "Event coverage" },
  ];

/**
 * Placeholder starting amounts, not authoritative prices. `deposit` matches
 * the value that was previously hardcoded in lib/stripe.ts; final_30/final_60
 * have no prior authoritative figure (the marketing copy in book.tsx and
 * terms.tsx already disagreed with each other and with the hardcoded
 * deposit). An admin should confirm/update these on the pricing page — the
 * Stripe fields stay null until they do, so nothing goes live from a seed
 * alone.
 */
const PRICING: Array<{ kind: string; amount_cents: number }> = [
  { kind: "deposit", amount_cents: 2000 },
  { kind: "final_30", amount_cents: 10000 },
  { kind: "final_60", amount_cents: 20000 },
];

async function main(): Promise<void> {
  logger.info("Seeding lookup tables");

  // No explicit `target`: the live database carries a `status_name`/`category_name`
  // unique constraint from the original Prisma/Supabase schema that was never
  // captured in schema.ts or the Drizzle baseline migration. Targeting only
  // `id` left this insert non-idempotent against a database that already has
  // these rows (e.g. restored from the production dump) under the same names
  // but different ids — bare ON CONFLICT DO NOTHING suppresses a conflict on
  // any unique constraint, not just the one this file happens to know about.
  await db.insert(appointment_status).values(STATUSES).onConflictDoNothing();

  await db.insert(category).values(CATEGORIES).onConflictDoNothing();

  // Explicit ids above leave the sequences behind; fast-forward them or the next
  // ordinary insert collides. Same hazard as db/sql/110_sync_sequences.sql.
  for (const table of ["appointment_status", "category"] as const) {
    await db.execute(sql`
      SELECT setval(
        pg_get_serial_sequence(${table}, 'id'),
        GREATEST((SELECT COALESCE(MAX(id), 1) FROM ${sql.identifier(table)}), 1)
      )
    `);
  }

  // kind is a text primary key, not a serial id, so there's no sequence to
  // fast-forward here.
  await db
    .insert(pricing_config)
    .values(PRICING)
    .onConflictDoNothing({ target: pricing_config.kind });

  // Singleton row, left blank — the admin fills in their phone number and
  // carrier from the settings page. notifyAdmin() warns and skips until they do.
  await db
    .insert(admin_settings)
    .values({ id: 1 })
    .onConflictDoNothing({ target: admin_settings.id });

  logger.info(
    { statuses: STATUSES.length, categories: CATEGORIES.length, pricing: PRICING.length },
    "Seed complete",
  );
}

main()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (err) => {
    logger.error({ err }, "Seed failed");
    await closeDb().catch(() => undefined);
    process.exit(1);
  });
