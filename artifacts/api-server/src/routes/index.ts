import { Router } from "express";
import adminRouter from "./admin/index";
import webhooksRouter from "./webhooks/index";

const router = Router();

router.get("/healthz", (_req, res): void => {
  res.json({ ok: true });
});

router.use("/admin", adminRouter);
router.use("/webhooks", webhooksRouter);

export default router;
