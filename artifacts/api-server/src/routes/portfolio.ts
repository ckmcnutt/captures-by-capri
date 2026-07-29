import { Router } from "express";
import { listPortfolioCategories } from "../repositories/portfolioMedia";

const router = Router();

router.get("/portfolio", async (req, res): Promise<void> => {
  try {
    res.json(await listPortfolioCategories());
  } catch (err) {
    req.log.error({ err }, "Failed to list portfolio photos");
    res.status(500).json({ error: "Failed to list portfolio photos" });
  }
});

export default router;
