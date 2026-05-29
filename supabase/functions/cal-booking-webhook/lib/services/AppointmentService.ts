import { SupabaseContext } from "@supabase/server";
import { Appointment, Database } from "../database.types.ts";

export class AppointmentService {
  private readonly ctx: SupabaseContext<Database>;

  constructor(ctx: SupabaseContext<Database>) {
    this.ctx = ctx;
  }

  public async insertAppointment(appt: Appointment) {
    const { error, data } = await this.ctx.supabase.from("appointment").insert(
      appt,
    ).select();

    if (error) throw error;
    return data[0].id;
  }
}
