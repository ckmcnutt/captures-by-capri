import { db } from "../db/client";
import { category, type CategoryRow } from "../db/schema";

export async function listCategories(): Promise<CategoryRow[]> {
  return db.select().from(category).orderBy(category.id);
}

/**
 * Match a Cal.com `session_type` answer to a category.
 *
 * Behaviour preserved verbatim from the Supabase edge function, including its
 * quirk: it tests whether the CATEGORY name contains the SESSION TYPE, so a short
 * session type can match an unrelated longer category name. Deliberately not
 * "fixed" here — that is a behaviour change and belongs in its own commit with
 * the real category list in hand. Callers log when this returns null.
 */
export function matchCategory(
  categories: CategoryRow[],
  sessionType: string,
): CategoryRow | null {
  const needle = sessionType.trim().toLowerCase();
  if (!needle) return null;
  return (
    categories.find((c) =>
      c.category_name?.toLowerCase().includes(needle),
    ) ?? null
  );
}
