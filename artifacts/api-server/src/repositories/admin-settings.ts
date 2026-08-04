import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { admin_settings, type AdminSettingsRow } from "../db/schema";

/** There is exactly one admin, so exactly one settings row, always at this id. */
const SETTINGS_ID = 1;

/**
 * Falls back to an all-null row rather than throwing when the singleton row
 * is missing (e.g. a database restored before this table existed and not yet
 * re-seeded) — matches how the rest of this app degrades to a warn-and-skip
 * on missing config instead of a hard failure.
 */
export async function getAdminSettings(): Promise<
  Pick<AdminSettingsRow, "admin_phone_number" | "admin_phone_carrier">
> {
  const [row] = await db
    .select({
      admin_phone_number: admin_settings.admin_phone_number,
      admin_phone_carrier: admin_settings.admin_phone_carrier,
    })
    .from(admin_settings)
    .where(eq(admin_settings.id, SETTINGS_ID))
    .limit(1);

  return row ?? { admin_phone_number: null, admin_phone_carrier: null };
}

export async function updateAdminSettings(values: {
  admin_phone_number: string;
  admin_phone_carrier: string;
}): Promise<AdminSettingsRow> {
  const [row] = await db
    .insert(admin_settings)
    .values({ id: SETTINGS_ID, ...values })
    .onConflictDoUpdate({
      target: admin_settings.id,
      set: { ...values, updated_at: new Date() },
    })
    .returning();
  return row;
}
