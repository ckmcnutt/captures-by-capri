import { Router } from "express";
import { listPortfolioPhotos } from "../repositories/photos";

const router = Router();

router.get("/portfolio", async (req, res): Promise<void> => {
  try {
    res.json(await listPortfolioPhotos());
  } catch (err) {
    req.log.error({ err }, "Failed to fetch portfolio photos");
    res.status(500).json({ error: "Failed to fetch portfolio photos" });
  }
});

export default router;
