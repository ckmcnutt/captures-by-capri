import { Router } from "express";
import adminRouter from "./admin/index";
import webhooksRouter from "./webhooks/index";
import portfolioRouter from "./portfolio";

const router = Router();

router.get("/healthz", (_req, res): void => {
  res.json({ ok: true });
});

router.use("/admin", adminRouter);
router.use("/webhooks", webhooksRouter);
router.use(portfolioRouter);

export default router;
