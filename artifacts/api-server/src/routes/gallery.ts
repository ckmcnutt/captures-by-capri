import { Router, type IRouter } from "express";
import { eq, asc, sql } from "drizzle-orm";
import { db, galleryTable } from "@workspace/db";
import {
  CreateGalleryImageBody,
  GetGalleryImageParams,
  DeleteGalleryImageParams,
  ListGalleryQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/gallery", async (req, res): Promise<void> => {
  const parsed = ListGalleryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const query = db
    .select()
    .from(galleryTable)
    .orderBy(asc(galleryTable.displayOrder), asc(galleryTable.createdAt));

  if (parsed.data.category) {
    const images = await db
      .select()
      .from(galleryTable)
      .where(eq(galleryTable.category, parsed.data.category))
      .orderBy(asc(galleryTable.displayOrder), asc(galleryTable.createdAt));
    res.json(images);
    return;
  }

  const images = await query;
  res.json(images);
});

router.post("/gallery", async (req, res): Promise<void> => {
  const parsed = CreateGalleryImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [image] = await db.insert(galleryTable).values(parsed.data).returning();
  res.status(201).json(image);
});

router.get("/gallery/categories", async (_req, res): Promise<void> => {
  const categories = await db
    .select({
      name: galleryTable.category,
      count: sql<number>`count(*)::int`,
    })
    .from(galleryTable)
    .groupBy(galleryTable.category)
    .orderBy(asc(galleryTable.category));

  res.json(categories);
});

router.get("/gallery/:id", async (req, res): Promise<void> => {
  const params = GetGalleryImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [image] = await db
    .select()
    .from(galleryTable)
    .where(eq(galleryTable.id, params.data.id));

  if (!image) {
    res.status(404).json({ error: "Gallery image not found" });
    return;
  }

  res.json(image);
});

router.delete("/gallery/:id", async (req, res): Promise<void> => {
  const params = DeleteGalleryImageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(galleryTable)
    .where(eq(galleryTable.id, params.data.id))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Gallery image not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
