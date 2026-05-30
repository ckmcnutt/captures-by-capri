import { Router, Request, Response } from "express";
import { stripe } from "../../lib/stripe";
import { supabase } from "../../lib/supabase";
import { confirmCalBooking } from "../../lib/calcom";
import { logger } from "../../lib/logger";

const router = Router();

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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const { appointmentId, invoiceType } = session.metadata ?? {};

    if (invoiceType !== "deposit" || !appointmentId) {
      res.json({ ok: true });
      return;
    }

    const id = parseInt(appointmentId, 10);
    if (isNaN(id)) {
      logger.warn({ appointmentId }, "Invalid appointmentId in Stripe metadata");
      res.json({ ok: true });
      return;
    }

    try {
      const { data: appt, error: fetchError } = await supabase
        .from("appointment")
        .select("id, cal_booking_uid")
        .eq("id", id)
        .single();

      if (fetchError || !appt) {
        logger.error({ err: fetchError, appointmentId: id }, "Appointment not found for Stripe webhook");
        res.json({ ok: true });
        return;
      }

      if (appt.cal_booking_uid) {
        await confirmCalBooking(appt.cal_booking_uid);
      }

      const [confirmedStatus, depositPaidStatus] = await Promise.all([
        supabase
          .from("appointment_status")
          .select("id")
          .eq("status_name", "appointment_confirmed")
          .limit(1)
          .single(),
        supabase
          .from("appointment_status")
          .select("id")
          .eq("status_name", "deposit_paid")
          .limit(1)
          .single(),
      ]);

      if (confirmedStatus.data) {
        await supabase
          .from("appointment")
          .update({ status_id: confirmedStatus.data.id })
          .eq("id", id);
      }

      if (depositPaidStatus.data) {
        await supabase
          .from("appointment")
          .update({ status_id: depositPaidStatus.data.id })
          .eq("id", id);
      }

      logger.info({ appointmentId: id }, "Deposit paid — appointment confirmed and deposit_paid status set");
    } catch (err) {
      logger.error({ err, appointmentId: id }, "Failed to process deposit payment webhook");
      res.status(500).json({ error: "Failed to process webhook" });
      return;
    }
  }

  res.json({ ok: true });
});

export default router;
