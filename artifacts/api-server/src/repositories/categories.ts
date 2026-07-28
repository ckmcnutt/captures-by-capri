import { db } from "../db/client";
import { category, type CategoryRow } from "../db/schema";

export async function listCategories(): Promise<CategoryRow[]> {
  return db.select().from(category).orderBy(category.id);
}

/**
 * Match a Cal.com `session_type` answer to a category.
 *
 * Checks containment in both directions. The original (Supabase edge function)
 * behaviour only checked CATEGORY name contains SESSION TYPE, which silently
 * broke in production: real category names are short single words ("other"),
 * but Cal.com's dropdown sends the full option label for at least one of them
 * ("Other (Specify in Additional Notes)") — longer than "other", so "other"
 * can never contain it. Every appointment with that session_type fell through
 * to the categories[0] fallback below instead of matching "other".
 *
 * Callers log when this returns null.
 */
export function matchCategory(
  categories: CategoryRow[],
  sessionType: string,
): CategoryRow | null {
  const needle = sessionType.trim().toLowerCase();
  if (!needle) return null;
  return (
    categories.find((c) => {
      const name = c.category_name?.toLowerCase();
      return !!name && (name.includes(needle) || needle.includes(name));
    }) ?? null
  );
}
