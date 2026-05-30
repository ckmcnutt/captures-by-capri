import { Router } from "express";
import adminRouter from "./admin/index";

const router = Router();

router.get("/healthz", (_req, res): void => {
  res.json({ ok: true });
});

router.use("/admin", adminRouter);

export default router;
