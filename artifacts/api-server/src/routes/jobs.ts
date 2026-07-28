import { Router } from "express";
import { isAdmin } from "../middleware/auth";
import { runScheduledJobs } from "../services/scheduled-jobs";

const router = Router();

/**
 * Manually trigger the scheduled jobs. Same code path the cron tick uses, so
 * there is exactly one implementation.
 *
 * NOT idempotent — it sends real SMS and email. When testing, leave the Twilio
 * credentials and SMTP_HOST unset: both transports degrade to a warn-and-skip.
 */
router.post("/run", isAdmin, async (req, res): Promise<void> => {
  try {
    const result = await runScheduledJobs(req.log as never);
    res.json({ ok: result.errors.length === 0, ...result });
  } catch (err) {
    req.log.error({ err }, "Manual scheduled-jobs run failed");
    res.status(500).json({ error: "Failed to run scheduled jobs" });
  }
});

export default router;
