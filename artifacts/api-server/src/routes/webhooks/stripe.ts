import { Router, type Request, type Response } from "express";
import { env } from "../../env";
import { confirmCalBooking } from "../../lib/calcom";
import { logger } from "../../lib/logger";
import { stripe } from "../../lib/stripe";
import {
  findByPaymentLinkId,
  getCalBookingUid,
  setStatus,
} from "../../repositories/appointments";
import { STATUS, getStatusId } from "../../repositories/status";

const router = Router();

async function handleDepositPaid(appointmentId: number): Promise<void> {
  const calBookingUid = await getCalBookingUid(appointmentId);

  if (calBookingUid) {
    await confirmCalBooking(calBookingUid);
  }

  // Two sequential transitions, preserved from the original: the appointment is
  // marked confirmed and then deposit_paid, so both states are represented in any
  // downstream audit of status changes.
  await setStatus(appointmentId, await getStatusId(STATUS.confirmed));
  await setStatus(appointmentId, await getStatusId(STATUS.depositPaid));

  logger.info(
    { appointmentId },
    "Deposit paid — appointment_confirmed then deposit_paid, Cal.com booking confirmed",
  );
}

async function handleFinalPaid(appointmentId: number): Promise<void> {
  await setStatus(appointmentId, await getStatusId(STATUS.invoicePaid));
  logger.info({ appointmentId }, "Final invoice paid — status set to invoice_paid");
}

function extractMetadata(
  metadata: Record<string, string> | null | undefined,
): { appointmentId: number | null; invoiceType: string | null } {
  const { appointmentId: rawId, invoiceType = null } = metadata ?? {};
  const parsed = rawId ? parseInt(rawId, 10) : NaN;
  return {
    appointmentId: Number.isNaN(parsed) ? null : parsed,
    invoiceType,
  };
}

async function resolveByPaymentLink(
  paymentLinkId: string | null | undefined,
): Promise<{ appointmentId: number; invoiceType: "deposit" | "final" } | null> {
  if (!paymentLinkId) return null;
  return findByPaymentLinkId(paymentLinkId);
}

router.post("/stripe", async (req: Request, res: Response): Promise<void> => {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    logger.error("STRIPE_WEBHOOK_SECRET is not configured");
    res.status(500).json({ error: "Webhook secret not configured" });
    return;
  }

  if (!stripe) {
    logger.error("Stripe client is not initialized");
    res.status(500).json({ error: "Stripe not configured" });
    return;
  }

  const sig = req.headers["stripe-signature"];
  if (!sig || typeof sig !== "string") {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  let event;
  try {
    // req.body is a Buffer here thanks to the express.raw mount in app.ts, which
    // must stay registered before express.json().
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    logger.error({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info({ type: event.type }, "Stripe webhook received");

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      // Payment-link id is the reliable route; metadata is the fallback.
      const byLink = await resolveByPaymentLink(
        session.payment_link as string | null,
      );
      const { appointmentId, invoiceType } =
        byLink ?? extractMetadata(session.metadata);

      if (appointmentId && invoiceType === "deposit") {
        await handleDepositPaid(appointmentId);
      } else if (appointmentId && invoiceType === "final") {
        await handleFinalPaid(appointmentId);
      }
    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const { appointmentId, invoiceType } = extractMetadata(intent.metadata);

      if (appointmentId && invoiceType === "deposit") {
        await handleDepositPaid(appointmentId);
      } else if (appointmentId && invoiceType === "final") {
        await handleFinalPaid(appointmentId);
      }
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "Failed to process Stripe webhook");
    res.status(500).json({ error: "Failed to process webhook" });
    return;
  }

  res.json({ ok: true });
});

export default router;
