import { Router } from "express";
import { isAdmin } from "../../middleware/auth";
import appointmentsRouter from "./appointments";
import actionsRouter from "./actions";

const router = Router();

router.get("/me", isAdmin, (_req, res): void => {
  res.json({ ok: true });
});

router.use(appointmentsRouter);
router.use(actionsRouter);

export default router;
