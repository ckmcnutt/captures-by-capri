import { asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { appointment, photo } from "../db/schema";

/**
 * Portfolio photos, in the shape the public /api/portfolio endpoint returns.
 * The nested `category` key matches the old PostgREST embed alias.
 */
export async function listPortfolioPhotos() {
  return db.query.photo.findMany({
    columns: { id: true, url: true, title: true },
    with: { category: { columns: { category_name: true } } },
    where: eq(photo.featured_portfolio, true),
    orderBy: [asc(photo.id)],
  });
}
