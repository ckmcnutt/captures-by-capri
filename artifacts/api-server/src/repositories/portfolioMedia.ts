import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../env";

const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);

export interface PortfolioPhoto {
  filename: string;
  url: string;
}

export interface PortfolioCategory {
  name: string;
  photos: PortfolioPhoto[];
}

/**
 * Portfolio categories and photos, read straight off disk instead of the
 * (now-unused) `photo` table: every subdirectory of MEDIA_DIR/portfolio is a
 * category, and every image file inside it is a photo. Adding, removing, or
 * reorganizing portfolio photos is just a filesystem operation on the host —
 * no DB write or deploy required, and the URL always matches the file's real
 * name/case (see the APFS-vs-ext4 case-sensitivity gotcha in the README).
 */
export async function listPortfolioCategories(): Promise<PortfolioCategory[]> {
  const portfolioDir = path.join(env.MEDIA_DIR, "portfolio");

  let entries: Dirent[];
  try {
    entries = await fs.readdir(portfolioDir, { withFileTypes: true });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }

  const categoryDirs = entries
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  return Promise.all(
    categoryDirs.map(async (dir) => {
      const categoryPath = path.join(portfolioDir, dir.name);
      const files = await fs.readdir(categoryPath, { withFileTypes: true });

      const photos = files
        .filter(
          (file) =>
            file.isFile() &&
            IMAGE_EXTENSIONS.has(path.extname(file.name).toLowerCase()),
        )
        .map((file) => file.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map((filename) => ({
          filename,
          url: `/media/portfolio/${encodeURIComponent(dir.name)}/${encodeURIComponent(filename)}`,
        }));

      return { name: dir.name, photos };
    }),
  );
}
