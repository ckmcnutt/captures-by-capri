import { SupabaseContext } from "@supabase/server";
import { Appointment, Database } from "../database.types.ts";

export class AppointmentService {
  private readonly ctx: SupabaseContext<Database>;

  constructor(ctx: SupabaseContext<Database>) {
    this.ctx = ctx;
  }

  public async insertAppointment(appointment: Appointment): Promise<number> {
    const { error, data } = await this.ctx.supabase.from("appointment").insert(
      appointment,
    ).select();

    if (error) throw error;
    return data[0].id;
  }

  public async updateAppointmentStatus(
    appointmentId: number,
    status_id: number,
    internal_notes: string
  ) {
    const { error } = await this.ctx.supabase
      .from("appointment")
      .update({ status_id, internal_notes })
      .eq("id", appointmentId);

    if (error) throw error;
  }
}
