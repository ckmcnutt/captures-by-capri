import { SupabaseContext } from "@supabase/server";
import { Database } from "../database.types.ts";
import { CalPayload } from "../models/cal.ts";
import { AppointmentService } from "../services/AppointmentService.ts";

export async function processBookingCanceled(
  payload: CalPayload,
  bookingId: number,
  ctx: SupabaseContext<Database>,
): Promise<void> {
  console.log(
    `Setting appointment ${bookingId} to status appointment_canceled...`,
  );
  const cancellationReason = `CANCELED BY USER: ${payload.cancellationReason}`;
  const appointmentService = new AppointmentService(ctx);
  await appointmentService.updateAppointmentStatus(
    bookingId,
    2,
    cancellationReason,
  ); // 2 = appointment_canceled
  console.log(
    `Appointment ${bookingId} status set to appointment_canceled successfully!`,
  );
}