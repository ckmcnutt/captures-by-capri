import { SupabaseContext } from "@supabase/server";
import { Database } from "../database.types.ts";
import { CalPayload } from "../models/cal.ts";

export async function processBookingCreated(
  payload: CalPayload,
  bookingId: number,
  ctx: SupabaseContext<Database>,
): Promise<void> {
}