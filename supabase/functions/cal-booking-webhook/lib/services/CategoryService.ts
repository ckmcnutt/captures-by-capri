import { SupabaseContext } from "@supabase/server";
import { Category, Database } from "../database.types.ts";

export class CategoryService {
  private readonly ctx: SupabaseContext<Database>;

  constructor(ctx: SupabaseContext<Database>) {
    this.ctx = ctx;
  }

  public async getCategory(categoryName: string): Promise<Category | null> {
    const { error, data } = await this.ctx.supabase
      .from("category")
      .select()
      .ilike("category_name", `%${categoryName}%`);

    if (error) throw error;
    console.log(data);
    return data[0] ?? null;
  }

  public async listCategories(): Promise<Category[] | null> {
    const { error, data } = await this.ctx.supabase
      .from("category")
      .select();

    if (error) throw error;
    return data;
  } 
}
