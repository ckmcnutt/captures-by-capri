import { Router } from "express";
import { supabase } from "../../lib/supabase";
import { isAdmin } from "../../middleware/auth";
import { sendSms } from "../../lib/twilio";
import { createDepositPaymentLink, stripe } from "../../lib/stripe";
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
      `id, cal_booking_uid, stripe_deposit_invoice_id,
       customer:customer_id ( first_name, last_name, email_address, phone_number, preferred_contact_method ),
       appointment_status:status_id ( status_name )`
    )
    .eq("id", id)
    .single();
  if (error) throw error;
  if (!data) throw new Error("Appointment not found");
  return data;
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

function parseId(raw: string | string[]): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str, 10);
}

router.post("/appointments/:id/confirm", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid appointment id" });
    return;
  }

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = Array.isArray(appt.customer) ? appt.customer[0] : appt.customer;
    const currentStatus = Array.isArray(appt.appointment_status)
      ? appt.appointment_status[0]?.status_name
      : appt.appointment_status?.status_name;

    if (currentStatus !== "appointment_requested") {
      res.status(400).json({ error: `Cannot confirm appointment in status: ${currentStatus}` });
      return;
    }

    if (!customer) {
      res.status(400).json({ error: "Appointment has no associated customer" });
      return;
    }

    const { url: paymentUrl, id: paymentLinkId } = await createDepositPaymentLink(id);

    const depositRequestedId = await getStatusId("deposit_requested");
    const { error: updateError } = await supabase
      .from("appointment")
      .update({
        stripe_deposit_invoice_id: paymentLinkId,
        status_id: depositRequestedId,
      })
      .eq("id", id);

    if (updateError) throw updateError;

    const message = `Hi ${customer.first_name}! Your photography session request with Captures By Capri has been reviewed. To confirm your appointment, please complete your $20 deposit here: ${paymentUrl}`;
    await notifyClient(customer, message);

    req.log.info({ appointmentId: id }, "Appointment confirmed — deposit requested");
    res.json({ ok: true, paymentUrl });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to confirm appointment");
    res.status(500).json({ error: "Failed to confirm appointment" });
  }
});

router.post("/appointments/:id/reject", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid appointment id" });
    return;
  }

  const { reason } = req.body as { reason?: string };

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = Array.isArray(appt.customer) ? appt.customer[0] : appt.customer;
    const currentStatus = Array.isArray(appt.appointment_status)
      ? appt.appointment_status[0]?.status_name
      : appt.appointment_status?.status_name;

    if (currentStatus !== "appointment_requested") {
      res.status(400).json({ error: `Cannot reject appointment in status: ${currentStatus}` });
      return;
    }

    if (appt.cal_booking_uid) {
      await declineCalBooking(
        appt.cal_booking_uid,
        reason ?? "We are unable to accommodate your request at this time."
      );
    }

    const rejectedId = await getStatusId("appointment_rejected");
    const { error: updateError } = await supabase
      .from("appointment")
      .update({ status_id: rejectedId })
      .eq("id", id);

    if (updateError) throw updateError;

    if (customer) {
      const message = `Hi ${customer.first_name}, we regret to inform you that your photography session request with Captures By Capri could not be accommodated. Please feel free to reach out to book a new time.`;
      await notifyClient(customer, message);
    }

    req.log.info({ appointmentId: id }, "Appointment rejected");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to reject appointment");
    res.status(500).json({ error: "Failed to reject appointment" });
  }
});

router.post("/appointments/:id/remind-deposit", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid appointment id" });
    return;
  }

  try {
    const appt = await getAppointmentWithCustomer(id);
    const customer = Array.isArray(appt.customer) ? appt.customer[0] : appt.customer;
    const currentStatus = Array.isArray(appt.appointment_status)
      ? appt.appointment_status[0]?.status_name
      : appt.appointment_status?.status_name;

    if (currentStatus !== "deposit_requested") {
      res.status(400).json({
        error: `Deposit reminder only available when status is deposit_requested (current: ${currentStatus})`,
      });
      return;
    }

    if (!appt.stripe_deposit_invoice_id) {
      res.status(400).json({ error: "No deposit payment link found for this appointment" });
      return;
    }

    if (!customer) {
      res.status(400).json({ error: "Appointment has no associated customer" });
      return;
    }

    if (!stripe) {
      res.status(500).json({ error: "Stripe is not configured" });
      return;
    }

    const paymentLink = await stripe.paymentLinks.retrieve(appt.stripe_deposit_invoice_id);

    const message = `Hi ${customer.first_name}, this is a friendly reminder to complete your $20 deposit with Captures By Capri: ${paymentLink.url}`;
    await notifyClient(customer, message);

    req.log.info({ appointmentId: id }, "Deposit reminder sent");
    res.json({ ok: true, paymentUrl: paymentLink.url });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to send deposit reminder");
    res.status(500).json({ error: "Failed to send deposit reminder" });
  }
});

export default router;
