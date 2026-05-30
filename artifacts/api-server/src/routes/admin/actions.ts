import { Router } from "express";
import { supabase } from "../../lib/supabase";
import { isAdmin } from "../../middleware/auth";
import { sendSms } from "../../lib/twilio";
import { createDepositPaymentLink, createFinalPaymentLink, stripe } from "../../lib/stripe";
import { declineCalBooking } from "../../lib/calcom";
import { logger } from "../../lib/logger";

const router = Router();

async function getStatusId(statusName: string): Promise<number> {
  const { data, error } = await supabase
    .from("appointment_status")
    .select("id")
    .eq("status_name", statusName)
    .limit(1)
    .single();
  if (error || !data) throw new Error(`Status not found: ${statusName}`);
  return data.id;
}

async function getAppointmentWithCustomer(id: number) {
  const { data, error } = await supabase
    .from("appointment")
    .select(
      `id, cal_booking_uid, stripe_deposit_invoice_id, stripe_final_invoice_id,
       final_invoice_amount, end_time,
       customer:customer_id ( first_name, last_name, email_address, phone_number, preferred_contact_method ),
       appointment_status:status_id ( status_name )`
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Appointment not found");
  return data;
}

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

function getCustomer(appt: Awaited<ReturnType<typeof getAppointmentWithCustomer>>) {
  return Array.isArray(appt.customer) ? appt.customer[0] : appt.customer;
}

function getStatusName(appt: Awaited<ReturnType<typeof getAppointmentWithCustomer>>) {
  const s = Array.isArray(appt.appointment_status)
    ? appt.appointment_status[0]
    : appt.appointment_status;
  return s?.status_name ?? null;
}

async function notifyClient(
  customer: { phone_number: string; email_address: string; preferred_contact_method: string },
  message: string
): Promise<void> {
  if (customer.preferred_contact_method === "sms") {
    await sendSms(customer.phone_number, message);
  } else {
    logger.info(
      { email: customer.email_address, message },
      "Email notification (email service not yet configured — logged only)"
    );
  }
}

// ── Confirm ──────────────────────────────────────────────────────────────────

router.post("/appointments/:id/confirm", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = getCustomer(appt);
    const currentStatus = getStatusName(appt);

    if (currentStatus !== "appointment_requested") {
      res.status(400).json({ error: `Cannot confirm appointment in status: ${currentStatus}` });
      return;
    }
    if (!customer) { res.status(400).json({ error: "No customer associated" }); return; }

    const { url: paymentUrl, id: paymentLinkId } = await createDepositPaymentLink(id);
    const depositRequestedId = await getStatusId("deposit_requested");
    const { error: updateError } = await supabase
      .from("appointment")
      .update({ stripe_deposit_invoice_id: paymentLinkId, status_id: depositRequestedId })
      .eq("id", id);
    if (updateError) throw updateError;

    const message = `Hi ${customer.first_name}! Your photography session request with Captures By Capri has been reviewed. Complete your $20 deposit here: ${paymentUrl}`;
    await notifyClient(customer, message);

    req.log.info({ appointmentId: id }, "Appointment confirmed — deposit requested");
    res.json({ ok: true, paymentUrl });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to confirm appointment");
    res.status(500).json({ error: "Failed to confirm appointment" });
  }
});

// ── Reject ────────────────────────────────────────────────────────────────────

router.post("/appointments/:id/reject", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }
  const { reason } = req.body as { reason?: string };

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = getCustomer(appt);
    const currentStatus = getStatusName(appt);

    if (currentStatus !== "appointment_requested") {
      res.status(400).json({ error: `Cannot reject appointment in status: ${currentStatus}` });
      return;
    }

    if (appt.cal_booking_uid) {
      await declineCalBooking(appt.cal_booking_uid, reason ?? "We are unable to accommodate your request at this time.");
    }

    const rejectedId = await getStatusId("appointment_rejected");
    const { error: updateError } = await supabase.from("appointment").update({ status_id: rejectedId }).eq("id", id);
    if (updateError) throw updateError;

    if (customer) {
      const message = `Hi ${customer.first_name}, we regret that your photography session request with Captures By Capri could not be accommodated. Please feel free to reach out to book a new time.`;
      await notifyClient(customer, message);
    }

    req.log.info({ appointmentId: id }, "Appointment rejected");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to reject appointment");
    res.status(500).json({ error: "Failed to reject appointment" });
  }
});

// ── Deposit reminder ──────────────────────────────────────────────────────────

router.post("/appointments/:id/remind-deposit", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = getCustomer(appt);
    const currentStatus = getStatusName(appt);

    if (currentStatus !== "deposit_requested") {
      res.status(400).json({ error: `Deposit reminder only available when status is deposit_requested (current: ${currentStatus})` });
      return;
    }
    if (!appt.stripe_deposit_invoice_id) { res.status(400).json({ error: "No deposit payment link found" }); return; }
    if (!customer) { res.status(400).json({ error: "No customer associated" }); return; }
    if (!stripe) { res.status(500).json({ error: "Stripe is not configured" }); return; }

    const paymentLink = await stripe.paymentLinks.retrieve(appt.stripe_deposit_invoice_id);
    const message = `Hi ${customer.first_name}, this is a reminder to complete your $20 deposit with Captures By Capri: ${paymentLink.url}`;
    await notifyClient(customer, message);

    req.log.info({ appointmentId: id }, "Deposit reminder sent");
    res.json({ ok: true, paymentUrl: paymentLink.url });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to send deposit reminder");
    res.status(500).json({ error: "Failed to send deposit reminder" });
  }
});

// ── Set final price ───────────────────────────────────────────────────────────

router.patch("/appointments/:id/set-price", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }
  const { amount } = req.body as { amount?: number };
  if (typeof amount !== "number" || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  try {
    const { error } = await supabase
      .from("appointment")
      .update({ final_invoice_amount: amount })
      .eq("id", id);
    if (error) throw error;
    req.log.info({ appointmentId: id, amount }, "Final invoice amount set");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to set price");
    res.status(500).json({ error: "Failed to set price" });
  }
});

// ── Send final invoice ────────────────────────────────────────────────────────

router.post("/appointments/:id/send-final-invoice", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = getCustomer(appt);
    const currentStatus = getStatusName(appt);

    if (currentStatus !== "deposit_paid") {
      res.status(400).json({ error: `Final invoice only available for deposit_paid appointments (current: ${currentStatus})` });
      return;
    }
    if (!appt.final_invoice_amount || appt.final_invoice_amount <= 0) {
      res.status(400).json({ error: "Set a final invoice amount before sending" });
      return;
    }
    if (!customer) { res.status(400).json({ error: "No customer associated" }); return; }

    const amountCents = Math.round(appt.final_invoice_amount * 100);
    const { url: paymentUrl, id: paymentLinkId } = await createFinalPaymentLink(id, amountCents);
    const invoiceSentId = await getStatusId("invoice_sent");
    const { error: updateErr } = await supabase
      .from("appointment")
      .update({ stripe_final_invoice_id: paymentLinkId, status_id: invoiceSentId })
      .eq("id", id);
    if (updateErr) throw updateErr;

    const message = `Hi ${customer.first_name}! Your final invoice of $${appt.final_invoice_amount.toFixed(2)} for your photography session with Captures By Capri is ready: ${paymentUrl}`;
    await notifyClient(customer, message);

    req.log.info({ appointmentId: id }, "Final invoice sent");
    res.json({ ok: true, paymentUrl });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to send final invoice");
    res.status(500).json({ error: "Failed to send final invoice" });
  }
});

// ── Final invoice reminder ────────────────────────────────────────────────────

router.post("/appointments/:id/remind-final-invoice", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = getCustomer(appt);
    const currentStatus = getStatusName(appt);

    if (currentStatus !== "invoice_sent") {
      res.status(400).json({ error: `Reminder only available when status is invoice_sent (current: ${currentStatus})` });
      return;
    }
    if (!appt.stripe_final_invoice_id) { res.status(400).json({ error: "No final invoice found" }); return; }
    if (!customer) { res.status(400).json({ error: "No customer associated" }); return; }
    if (!stripe) { res.status(500).json({ error: "Stripe is not configured" }); return; }

    const paymentLink = await stripe.paymentLinks.retrieve(appt.stripe_final_invoice_id);
    const message = `Hi ${customer.first_name}, this is a reminder to complete your final payment for your Captures By Capri session: ${paymentLink.url}`;
    await notifyClient(customer, message);

    req.log.info({ appointmentId: id }, "Final invoice reminder sent");
    res.json({ ok: true, paymentUrl: paymentLink.url });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to send final invoice reminder");
    res.status(500).json({ error: "Failed to send final invoice reminder" });
  }
});

// ── Mark as editing ───────────────────────────────────────────────────────────

router.post("/appointments/:id/mark-editing", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await getAppointmentWithCustomer(id);
    const currentStatus = getStatusName(appt);

    if (currentStatus !== "invoice_paid" && currentStatus !== "deposit_paid") {
      res.status(400).json({ error: `Mark as editing only available for invoice_paid or deposit_paid appointments (current: ${currentStatus})` });
      return;
    }
    if (new Date(appt.end_time) > new Date()) {
      res.status(400).json({ error: "Appointment has not ended yet" });
      return;
    }

    const editingId = await getStatusId("editing_photos");
    const { error: updateErr } = await supabase.from("appointment").update({ status_id: editingId }).eq("id", id);
    if (updateErr) throw updateErr;

    req.log.info({ appointmentId: id }, "Appointment marked as editing");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to mark as editing");
    res.status(500).json({ error: "Failed to mark as editing" });
  }
});

// ── Send photo link ───────────────────────────────────────────────────────────

router.post("/appointments/:id/send-photo-link", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }
  const { photoUrl } = req.body as { photoUrl?: string };
  if (!photoUrl?.trim()) { res.status(400).json({ error: "photoUrl is required" }); return; }

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = getCustomer(appt);
    const currentStatus = getStatusName(appt);

    if (currentStatus !== "editing_photos") {
      res.status(400).json({ error: `Photo link only available when status is editing_photos (current: ${currentStatus})` });
      return;
    }
    if (!customer) { res.status(400).json({ error: "No customer associated" }); return; }

    const photosReleasedId = await getStatusId("photos_released");
    const { error: updateErr } = await supabase
      .from("appointment")
      .update({ photo_delivery_url: photoUrl.trim(), status_id: photosReleasedId })
      .eq("id", id);
    if (updateErr) throw updateErr;

    const message = `Hi ${customer.first_name}! Your photos from your session with Captures By Capri are ready. View and download here: ${photoUrl.trim()}`;
    await notifyClient(customer, message);

    req.log.info({ appointmentId: id }, "Photo link sent");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to send photo link");
    res.status(500).json({ error: "Failed to send photo link" });
  }
});

export default router;
