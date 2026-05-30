import { SupabaseContext } from "@supabase/server";
import { Database } from "../database.types.ts";
import { CalPayload } from "../models/cal.ts";
import { AppointmentService } from "../services/AppointmentService.ts";

export async function processBookingRejected(
  payload: CalPayload,
  bookingId: number,
  ctx: SupabaseContext<Database>,
): Promise<void> {
  console.log(
    `Setting appointment ${bookingId} to status appointment_rejected...`,
  );
  const rejectionReason = `REJECTED: ${payload.rejectionReason}`;
  const appointmentService = new AppointmentService(ctx);
  await appointmentService.updateAppointmentStatus(
    bookingId,
    12,
    rejectionReason,
  ); // 12 = appointment_rejected
  console.log(
    `Appointment ${bookingId} status set to appointment_rejected successfully!`,
  );
}