import { SupabaseContext } from "@supabase/server";
import { Customer, Database } from "../database.types.ts";

export class CustomerService {
  private readonly ctx: SupabaseContext<Database>;

  constructor(ctx: SupabaseContext<Database>) {
    this.ctx = ctx;
  }

  public async insertCustomer(customer: Customer): Promise<number> {
    const { error, data } = await this.ctx.supabase.from("customer").insert(
      customer,
    ).select();

    if (error) throw error;
    return data[0].id;
  }

  public async getCustomerByEmail(email: string): Promise<Customer | null> {
    const { data, error } = await this.ctx.supabase
      .from("customer")
      .select()
      .eq("email_address", email);

    if (error) throw error;
    return data[0] ?? null;
  }
}
