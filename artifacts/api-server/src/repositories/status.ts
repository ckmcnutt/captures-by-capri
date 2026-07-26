import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { appointment_status } from "../db/schema";

/**
 * Appointment status names, centralised.
 *
 * Before the migration this lookup existed in three places with three different
 * failure modes (throw / null / null), and the Cal.com webhook bypassed it
 * entirely by hardcoding the magic ids 2 and 12. One implementation now, and
 * ids are always resolved by name.
 */
export const STATUS = {
  requested: "appointment_requested",
  confirmed: "appointment_confirmed",
  canceled: "appointment_canceled",
  rejected: "appointment_rejected",
  depositRequested: "deposit_requested",
  depositPaid: "deposit_paid",
  invoiceSent: "invoice_sent",
  invoicePaid: "invoice_paid",
  editing: "editing_photos",
  released: "photos_released",
  complete: "appointment_complete",
} as const;

export type StatusName = (typeof STATUS)[keyof typeof STATUS];

// appointment_status is a static lookup table, so caching is safe and removes
// roughly half a dozen round-trips per scheduled-jobs run.
const idByName = new Map<string, number>();

/** Resolve a status name to its id. Throws on an unknown name. */
export async function getStatusId(name: string): Promise<number> {
  const cached = idByName.get(name);
  if (cached !== undefined) return cached;

  const [row] = await db
    .select({ id: appointment_status.id })
    .from(appointment_status)
    .where(eq(appointment_status.status_name, name))
    .limit(1);

  if (!row) throw new Error(`Unknown appointment status: ${name}`);

  idByName.set(name, row.id);
  return row.id;
}

/**
 * Resolve several status names at once. Unknown names are silently absent from
 * the result — callers decide what that means (see listAppointments, which fails
 * closed rather than returning everything).
 */
export async function getStatusIds(names: string[]): Promise<number[]> {
  if (names.length === 0) return [];

  const uncached = names.filter((n) => !idByName.has(n));
  if (uncached.length > 0) {
    const rows = await db
      .select({
        id: appointment_status.id,
        status_name: appointment_status.status_name,
      })
      .from(appointment_status)
      .where(inArray(appointment_status.status_name, uncached));
    for (const row of rows) idByName.set(row.status_name, row.id);
  }

  return names
    .map((n) => idByName.get(n))
    .filter((id): id is number => id !== undefined);
}

/** Test seam: drop the cache after a migration or seed changes the lookup table. */
export function clearStatusCache(): void {
  idByName.clear();
}
