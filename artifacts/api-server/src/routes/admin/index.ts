import { Router } from "express";
import { env } from "../../env";
import { rateLimit } from "../../lib/rate-limit";
import { checkPassword, clearSession, issueSession } from "../../lib/session";
import { isAdmin } from "../../middleware/auth";
import actionsRouter from "./actions";
import appointmentsRouter from "./appointments";
import pricingRouter from "./pricing";

const router = Router();

/**
 * Login is unauthenticated by nature and guards a single shared password, so it
 * needs a brake against brute force: 5 attempts per 15 minutes per IP.
 */
const loginLimiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 });

router.post("/login", loginLimiter, (req, res): void => {
  const { password } = req.body as { password?: unknown };

  if (!checkPassword(password)) {
    req.log.warn({ ip: req.ip }, "Failed admin login attempt");
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  issueSession(res);
  req.log.info({ ip: req.ip }, "Admin logged in");
  res.json({ ok: true });
});

router.post("/logout", (req, res): void => {
  clearSession(res);
  req.log.info("Admin logged out");
  res.json({ ok: true });
});

/** Session probe used by the frontend auth guard. Also carries the deployed
 * commit hash so the admin dashboard can confirm a deploy landed. */
router.get("/me", isAdmin, (_req, res): void => {
  res.json({ ok: true, commit: env.GIT_COMMIT });
});

router.use(appointmentsRouter);
router.use(actionsRouter);
router.use(pricingRouter);

export default router;
