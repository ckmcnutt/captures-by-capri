import { SupabaseContext } from "@supabase/server";
import { CalPayload } from "../models/cal.ts";
import { AppointmentService } from "../services/AppointmentService.ts";
import { Database } from "../database.types.ts";

export async function processBookingRescheduled(
  payload: CalPayload,
  bookingId: number,
  ctx: SupabaseContext<Database>
): Promise<void> {
}
