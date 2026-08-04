import { sql, type SQL } from "drizzle-orm";
import {
  foreignKey,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  type PgColumn,
} from "drizzle-orm/pg-core";

/** Keeps the lower(email_address) expression index readable below. */
function lower(col: PgColumn): SQL {
  return sql`lower(${col})`;
}

/**
 * Postgres schema for captures-by-capri.
 *
 * Conventions that matter — do not "tidy" these away:
 *
 * 1. JS property names are snake_case, matching the column names exactly.
 *    The admin dashboard consumes `start_time`, `email_address`, etc. Keeping the
 *    keys identical means `res.json(rows)` reproduces what Supabase's PostgREST
 *    returned, so the frontend needed no data-shape changes during the migration.
 *
 * 2. Timestamps use `mode: "date"`. With `mode: "string"` the driver returns
 *    Postgres' text form (`2026-06-01 14:00:00+00`), which is NOT ISO-8601;
 *    `new Date()` on it is implementation-defined. The dashboard feeds these
 *    straight to `new Date()` and date-fns `format()`. A JS Date serialises to
 *    `2026-06-01T14:00:00.000Z`, matching PostgREST.
 *
 * 3. `final_invoice_amount` uses `mode: "number"`. node-postgres returns NUMERIC
 *    as a string; PostgREST returned a JSON number. Code does `.toFixed(2)` on
 *    this value, which is a TypeError on a string.
 *
 * 4. Foreign key constraint names are pinned to the original capital-A forms
 *    (`Appointment_category_id_fkey`) so migrations generated against the real
 *    production database don't want to rename every constraint.
 */

export const appointment_status = pgTable("appointment_status", {
  id: serial("id").primaryKey().notNull(),
  status_name: text("status_name").notNull(),
  status_desc: text("status_desc"),
});

export const category = pgTable("category", {
  id: serial("id").primaryKey().notNull(),
  category_name: text("category_name").notNull(),
  category_desc: text("category_desc"),
});

export const customer = pgTable(
  "customer",
  {
    id: serial("id").primaryKey().notNull(),
    first_name: text("first_name").notNull(),
    last_name: text("last_name").notNull(),
    email_address: text("email_address").notNull(),
    phone_number: text("phone_number").notNull(),
    preferred_contact_method: text("preferred_contact_method")
      .default("email")
      .notNull(),
  },
  (t) => [
    // Makes the Cal.com webhook's find-or-create an atomic upsert instead of a
    // racy select-then-insert. Lowercased so casing variations can't duplicate.
    uniqueIndex("customer_email_lower_uniq").on(lower(t.email_address)),
  ],
);

export const appointment = pgTable(
  "appointment",
  {
    // NOT generatedAlwaysAsIdentity: the Cal.com webhook inserts an explicit id
    // (the Cal bookingId), which ALWAYS identity would reject outright.
    id: serial("id").primaryKey().notNull(),
    aesthetic: text("aesthetic").notNull(),
    cal_booking_uid: text("cal_booking_uid"),
    category_id: integer("category_id").notNull(),
    customer_id: integer("customer_id"),
    status_id: integer("status_id"),
    start_time: timestamp("start_time", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    end_time: timestamp("end_time", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    customer_notes: text("customer_notes"),
    internal_notes: text("internal_notes"),
    stripe_deposit_invoice_id: text("stripe_deposit_invoice_id"),
    stripe_deposit_url: text("stripe_deposit_url"),
    stripe_final_invoice_id: text("stripe_final_invoice_id"),
    stripe_final_url: text("stripe_final_url"),
    final_invoice_amount: numeric("final_invoice_amount", {
      precision: 10,
      scale: 2,
      mode: "number",
    }),
    photo_delivery_url: text("photo_delivery_url"),
    created_at: timestamp("created_at", { withTimezone: true, mode: "date" })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: "Appointment_category_id_fkey",
      columns: [t.category_id],
      foreignColumns: [category.id],
    }),
    foreignKey({
      name: "Appointment_customer_id_fkey",
      columns: [t.customer_id],
      foreignColumns: [customer.id],
    }),
    foreignKey({
      name: "Appointment_status_id_fkey",
      columns: [t.status_id],
      foreignColumns: [appointment_status.id],
    }),
    // Supports the Stripe webhook's OR lookup across both payment-link columns.
    index("appointment_stripe_deposit_invoice_idx").on(
      t.stripe_deposit_invoice_id,
    ),
    index("appointment_stripe_final_invoice_idx").on(t.stripe_final_invoice_id),
    // The Cal webhook updates status by cal_booking_uid.
    index("appointment_cal_booking_uid_idx").on(t.cal_booking_uid),
  ],
);

/**
 * The persistent, reusable Stripe payment links this app now sends to
 * customers, one row per `kind`. Editing a row's `amount_cents` (via the admin
 * pricing page) regenerates its Stripe Price + Payment Link and makes that the
 * default for all future confirm/send-final-invoice actions — it deliberately
 * does not touch appointments that already reference the previous link.
 *
 * `kind` is a plain text primary key rather than a pg enum, matching this
 * schema's existing convention (see `status_name`, `preferred_contact_method`)
 * of validating a fixed set of values in application code.
 */
export const pricing_config = pgTable("pricing_config", {
  kind: text("kind").primaryKey().notNull(),
  amount_cents: integer("amount_cents").notNull(),
  stripe_price_id: text("stripe_price_id"),
  stripe_payment_link_id: text("stripe_payment_link_id"),
  stripe_payment_link_url: text("stripe_payment_link_url"),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

/**
 * Singleton row (always `id = 1`) holding the photographer's own phone number
 * and carrier, used by `notifyAdmin` (services/notifications.ts) to text
 * booking/payment alerts via that carrier's SMS-to-email gateway. Unlike
 * client numbers, the carrier isn't looked up via AbstractAPI on every send —
 * it's the admin's own phone, so it's picked once from the fixed carrier list
 * in lib/carrier-lookup.ts and stored here as that carrier's `id`.
 */
export const admin_settings = pgTable("admin_settings", {
  id: integer("id").primaryKey().notNull(),
  admin_phone_number: text("admin_phone_number"),
  admin_phone_carrier: text("admin_phone_carrier"),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
});

export type AdminSettingsRow = typeof admin_settings.$inferSelect;

export type PricingConfigRow = typeof pricing_config.$inferSelect;
export type PricingConfigInsert = typeof pricing_config.$inferInsert;

export type AppointmentRow = typeof appointment.$inferSelect;
export type AppointmentInsert = typeof appointment.$inferInsert;
export type CustomerRow = typeof customer.$inferSelect;
export type CustomerInsert = typeof customer.$inferInsert;
export type CategoryRow = typeof category.$inferSelect;
export type AppointmentStatusRow = typeof appointment_status.$inferSelect;
