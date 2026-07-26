import crypto from "node:crypto";
import { Router, type Request, type Response } from "express";
import { env } from "../../env";
import { logger } from "../../lib/logger";
import {
  processCalWebhook,
  WebhookError,
  type CalEventMessage,
} from "../../services/cal-webhook";

const router = Router();

/**
 * Verify Cal.com's HMAC signature over the raw request body.
 *
 * The Supabase edge function this replaces had NO verification whatsoever
 * (`verify_jwt = false` and no signature check), leaving a public endpoint that
 * creates customers and appointments and sends SMS to the photographer's phone.
 * Anyone who found the URL could spam it, or cancel real bookings by guessing a
 * cal_booking_uid.
 *
 * Fails closed when CAL_WEBHOOK_SECRET is unset, so a misconfiguration is a loud
 * 401 rather than a silently open write path.
 */
function verifyCalSignature(raw: Buffer, header: unknown): boolean {
  if (!env.CAL_WEBHOOK_SECRET) {
    logger.error(
      "CAL_WEBHOOK_SECRET is not configured — rejecting Cal webhook. " +
        "Set it here and in the Cal.com webhook UI.",
    );
    return false;
  }
  if (typeof header !== "string" || header.length === 0) return false;

  const expected = crypto
    .createHmac("sha256", env.CAL_WEBHOOK_SECRET)
    .update(raw)
    .digest("hex");

  // Cal.com sends bare hex; tolerate a "sha256=" prefix in case that changes.
  const provided = header.replace(/^sha256=/i, "");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

router.post("/cal", async (req: Request, res: Response): Promise<void> => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Buffer thanks to the express.raw mount in app.ts, registered before
  // express.json() — a parsed body would break the signature check.
  const raw = req.body as Buffer;

  if (!Buffer.isBuffer(raw)) {
    logger.error("Cal webhook body is not a Buffer — check the express.raw mount order");
    res.status(500).json({ error: "Misconfigured webhook body parser" });
    return;
  }

  if (!verifyCalSignature(raw, req.headers["x-cal-signature-256"])) {
    req.log.warn(
      { ip: req.ip },
      "Cal webhook signature verification failed",
    );
    res.status(401).json({ error: "Invalid signature" });
    return;
  }

  let msg: CalEventMessage;
  try {
    msg = JSON.parse(raw.toString("utf8")) as CalEventMessage;
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  try {
    await processCalWebhook(msg, req.log as never);
    res.json({ ok: true });
  } catch (err) {
    if (err instanceof WebhookError) {
      req.log.warn({ err, trigger: msg.triggerEvent }, "Cal webhook rejected");
      res.status(err.status).json({ error: err.message });
      return;
    }
    req.log.error({ err, trigger: msg.triggerEvent }, "Cal webhook failed");
    res.status(500).json({ error: "Failed to process webhook" });
  }
});

export default router;
