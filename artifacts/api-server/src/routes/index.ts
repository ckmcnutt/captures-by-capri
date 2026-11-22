import { Router } from "express";
import portfolioRouter from "./portfolio";

const router = Router();

router.get("/healthz", (_req, res): void => {
  res.json({ ok: true });
});

router.use(portfolioRouter);

export default router;
