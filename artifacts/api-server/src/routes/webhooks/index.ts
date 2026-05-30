import { Router, Request, Response } from "express";
import { stripe } from "../../lib/stripe";
import { supabase } from "../../lib/supabase";
import { confirmCalBooking } from "../../lib/calcom";
import { logger } from "../../lib/logger";

const router = Router();

async function getStatusId(statusName: string): Promise<number | null> {
  const { data } = await supabase
    .from("appointment_status")
    .select("id")
    .eq("status_name", statusName)
    .limit(1)
    .single();
  return data?.id ?? null;
}

router.post("/stripe", async (req: Request, res: Response): Promise<void> => {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
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
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, webhookSecret);
  } catch (err) {
    logger.error({ err }, "Stripe webhook signature verification failed");
    res.status(400).json({ error: "Invalid signature" });
    return;
  }

  logger.info({ type: event.type }, "Stripe webhook received");

  async function handleDepositPaid(appointmentId: number): Promise<void> {
    const { data: appt, error: fetchError } = await supabase
      .from("appointment")
      .select("id, cal_booking_uid")
      .eq("id", appointmentId)
      .single();

    if (fetchError || !appt) {
      logger.error({ err: fetchError, appointmentId }, "Appointment not found for deposit webhook");
      return;
    }

    if (appt.cal_booking_uid) {
      await confirmCalBooking(appt.cal_booking_uid);
    }

    const confirmedStatusId = await getStatusId("appointment_confirmed");
    if (confirmedStatusId) {
      await supabase.from("appointment").update({ status_id: confirmedStatusId }).eq("id", appointmentId);
    }

    const depositPaidStatusId = await getStatusId("deposit_paid");
    if (depositPaidStatusId) {
      await supabase.from("appointment").update({ status_id: depositPaidStatusId }).eq("id", appointmentId);
    }

    logger.info({ appointmentId }, "Deposit paid — status: appointment_confirmed → deposit_paid, Cal.com booking confirmed");
  }

  async function handleFinalPaid(appointmentId: number): Promise<void> {
    const invoicePaidStatusId = await getStatusId("invoice_paid");
    if (invoicePaidStatusId) {
      await supabase.from("appointment").update({ status_id: invoicePaidStatusId }).eq("id", appointmentId);
    }
    logger.info({ appointmentId }, "Final invoice paid — status set to invoice_paid");
  }

  function extractMetadata(metadata: Record<string, string> | null | undefined): { appointmentId: number | null; invoiceType: string | null } {
    const { appointmentId: rawId, invoiceType = null } = metadata ?? {};
    const appointmentId = rawId ? parseInt(rawId, 10) : null;
    return { appointmentId: appointmentId && !isNaN(appointmentId) ? appointmentId : null, invoiceType };
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { appointmentId, invoiceType } = extractMetadata(session.metadata);
      if (!appointmentId || (invoiceType !== "deposit" && invoiceType !== "final")) {
        res.json({ ok: true });
        return;
      }
      if (invoiceType === "deposit") await handleDepositPaid(appointmentId);
      else if (invoiceType === "final") await handleFinalPaid(appointmentId);

    } else if (event.type === "invoice.paid") {
      const invoice = event.data.object;
      const { appointmentId, invoiceType } = extractMetadata(invoice.metadata);
      if (!appointmentId || (invoiceType !== "deposit" && invoiceType !== "final")) {
        res.json({ ok: true });
        return;
      }
      if (invoiceType === "deposit") await handleDepositPaid(appointmentId);
      else if (invoiceType === "final") await handleFinalPaid(appointmentId);

    } else if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object;
      const { appointmentId, invoiceType } = extractMetadata(intent.metadata);
      if (!appointmentId || (invoiceType !== "deposit" && invoiceType !== "final")) {
        res.json({ ok: true });
        return;
      }
      if (invoiceType === "deposit") await handleDepositPaid(appointmentId);
      else if (invoiceType === "final") await handleFinalPaid(appointmentId);
    }
  } catch (err) {
    logger.error({ err, type: event.type }, "Failed to process Stripe webhook");
    res.status(500).json({ error: "Failed to process webhook" });
    return;
  }

  res.json({ ok: true });
});

export default router;
