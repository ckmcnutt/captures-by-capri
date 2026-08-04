import { Router, type Request, type Response } from "express";
import { env } from "../../env";
import { confirmCalBooking } from "../../lib/calcom";
import { logger } from "../../lib/logger";
import { stripe } from "../../lib/stripe";
import {
  findByPaymentLinkId,
  getAppointment,
  updateAppointment,
} from "../../repositories/appointments";
import { STATUS, getStatusId } from "../../repositories/status";
import { notifyAdmin } from "../../services/notifications";

const router = Router();

/**
 * Both handlers below check the appointment's current payment flags before
 * doing anything, and no-op if the precondition isn't met.
 *
 * Stripe retries webhook deliveries that don't return 2xx, and a single
 * successful payment can emit more than one event type (checkout.session and
 * payment_intent). Without this guard, a duplicate delivery would re-run
 * confirmCalBooking against an already-confirmed Cal.com booking — which, if
 * Cal.com rejects the redundant confirm with a non-2xx, throws, 500s this
 * handler, and gets Stripe retrying indefinitely. Checking the flags first
 * turns a duplicate delivery into a safe no-op instead.
 *
 * This doesn't close every race (two deliveries landing at truly the same
 * instant could both read the pre-transition flags before either writes), but
 * that's a far smaller window than the retry-driven duplicates this is
 * actually guarding against.
 */

async function handleDepositPaid(appointmentId: number): Promise<void> {
  const appt = await getAppointment(appointmentId);
  if (!appt || !appt.deposit_requested || appt.deposit_paid) {
    logger.info(
      { appointmentId, found: !!appt, depositRequested: appt?.deposit_requested, depositPaid: appt?.deposit_paid },
      "Deposit-paid webhook ignored — appointment isn't awaiting a deposit (already processed, or a duplicate delivery)",
    );
    return;
  }

  if (appt.cal_booking_uid) {
    await confirmCalBooking(appt.cal_booking_uid);
  }

  await updateAppointment(appointmentId, {
    deposit_paid: true,
    status_id: await getStatusId(STATUS.confirmed),
  });

  logger.info(
    { appointmentId },
    "Deposit paid — appointment confirmed, Cal.com booking confirmed",
  );

  const clientName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : `#${appointmentId}`;
  await notifyAdmin(`Deposit paid! Client: ${clientName}. Appointment confirmed.`);
}

async function handleFinalPaid(appointmentId: number): Promise<void> {
  const appt = await getAppointment(appointmentId);
  if (!appt || !appt.invoice_sent || appt.invoice_paid) {
    logger.info(
      { appointmentId, found: !!appt, invoiceSent: appt?.invoice_sent, invoicePaid: appt?.invoice_paid },
      "Final-invoice-paid webhook ignored — appointment isn't awaiting final payment (already processed, or a duplicate delivery)",
    );
    return;
  }

  await updateAppointment(appointmentId, { invoice_paid: true });
  logger.info({ appointmentId }, "Final invoice paid");

  const clientName = appt.customer
    ? `${appt.customer.first_name} ${appt.customer.last_name}`
    : `#${appointmentId}`;
  const amountStr =
    typeof appt.final_invoice_amount === "number"
      ? ` ($${appt.final_invoice_amount.toFixed(2)})`
      : "";
  await notifyAdmin(`Final invoice paid! Client: ${clientName}.${amountStr}`);
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

function invoiceTypeFromKind(kind: string | undefined): "deposit" | "final" | null {
  if (kind === "deposit") return "deposit";
  if (kind === "final_30" || kind === "final_60") return "final";
  return null;
}

/** Only the fields this resolver actually reads off a Checkout Session. */
interface ResolvableCheckoutSession {
  client_reference_id: string | null;
  payment_link: string | { id: string } | null;
  metadata: Record<string, string> | null;
}

/**
 * Resolve which appointment a completed checkout belongs to.
 *
 * Every Checkout Session is created directly by this app, one per appointment
 * (see lib/stripe.ts#createCheckoutSession), with `client_reference_id` set to
 * the appointment id and `metadata.kind` set to which invoice it is
 * (`deposit` | `final_30` | `final_60`) — both are read straight off the
 * session here.
 *
 * A session with neither of those predates the move to per-appointment
 * Checkout Sessions (a still-outstanding persistent Payment Link, or an even
 * older one-off link) — those fall back to the original 1:1
 * `findByPaymentLinkId`/metadata lookup, kept around for exactly that
 * transition window.
 */
async function resolveCheckoutSession(
  session: ResolvableCheckoutSession,
): Promise<{ appointmentId: number; invoiceType: "deposit" | "final" } | null> {
  const refId = session.client_reference_id
    ? parseInt(session.client_reference_id, 10)
    : NaN;

  if (!Number.isNaN(refId)) {
    const invoiceType = invoiceTypeFromKind(session.metadata?.kind);
    if (invoiceType) return { appointmentId: refId, invoiceType };
  }

  const byLink = await resolveByPaymentLink(session.payment_link as string | null);
  if (byLink) return byLink;

  const { appointmentId, invoiceType } = extractMetadata(session.metadata);
  if (appointmentId && (invoiceType === "deposit" || invoiceType === "final")) {
    return { appointmentId, invoiceType };
  }
  return null;
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
      const resolved = await resolveCheckoutSession(session);

      if (resolved?.invoiceType === "deposit") {
        await handleDepositPaid(resolved.appointmentId);
      } else if (resolved?.invoiceType === "final") {
        await handleFinalPaid(resolved.appointmentId);
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
