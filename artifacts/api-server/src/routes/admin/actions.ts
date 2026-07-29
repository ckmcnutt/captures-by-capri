import { Router, type Response } from "express";
import { declineCalBooking } from "../../lib/calcom";
import { appendClientReference } from "../../lib/stripe";
import { isAdmin } from "../../middleware/auth";
import { getPricingByKind, PRICING_KIND } from "../../repositories/pricing";
import {
  getAppointment,
  updateAppointment,
  type AppointmentDetail,
} from "../../repositories/appointments";
import { STATUS, getStatusId } from "../../repositories/status";
import { issueFinalInvoice } from "../../services/final-invoice";
import { notifyClient } from "../../services/notifications";

const router = Router();

function parseId(raw: string | string[] | undefined): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str ?? "", 10);
}

/**
 * Load an appointment and assert its current status, replying with the right error
 * if anything is off.
 *
 * The old code repeated this preamble in eight handlers, along with
 * `getCustomer()` / `getStatusName()` helpers that unwrapped PostgREST embeds
 * which were sometimes arrays and sometimes objects. Drizzle's `one()` relations
 * always return object-or-null, so all of that is gone.
 *
 * Returns null when a response has already been sent.
 */
async function loadForAction(
  res: Response,
  id: number,
  allowedStatuses: readonly string[],
): Promise<NonNullable<AppointmentDetail> | null> {
  const appointment = await getAppointment(id);

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return null;
  }

  const current = appointment.appointment_status?.status_name ?? null;
  if (!current || !allowedStatuses.includes(current)) {
    res.status(400).json({
      error:
        allowedStatuses.length === 1
          ? `Cannot perform this action on an appointment in status: ${current}`
          : `Action requires status ${allowedStatuses.join(" or ")} (current: ${current})`,
    });
    return null;
  }

  return appointment;
}

// ── Confirm ──────────────────────────────────────────────────────────────────

router.post("/appointments/:id/confirm", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await loadForAction(res, id, [STATUS.requested]);
    if (!appt) return;
    if (!appt.customer) { res.status(400).json({ error: "No customer associated" }); return; }

    const depositConfig = await getPricingByKind(PRICING_KIND.deposit);
    if (!depositConfig?.stripe_payment_link_url || !depositConfig.stripe_payment_link_id) {
      res.status(400).json({ error: "Deposit pricing is not configured yet — set it on the admin pricing page first." });
      return;
    }

    const paymentUrl = appendClientReference(depositConfig.stripe_payment_link_url, id);
    const depositAmount = (depositConfig.amount_cents / 100).toFixed(2);

    await updateAppointment(id, {
      stripe_deposit_invoice_id: depositConfig.stripe_payment_link_id,
      stripe_deposit_url: paymentUrl,
      status_id: await getStatusId(STATUS.depositRequested),
    });

    await notifyClient(
      appt.customer,
      `Hi ${appt.customer.first_name}! Your photography session request with Captures By Capri has been reviewed. Complete your $${depositAmount} deposit here: ${paymentUrl}`,
      "Your session is confirmed — complete your deposit",
    );

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
    const appt = await loadForAction(res, id, [STATUS.requested]);
    if (!appt) return;

    if (appt.cal_booking_uid) {
      await declineCalBooking(
        appt.cal_booking_uid,
        reason ?? "We are unable to accommodate your request at this time.",
      );
    }

    await updateAppointment(id, {
      status_id: await getStatusId(STATUS.rejected),
    });

    if (appt.customer) {
      await notifyClient(
        appt.customer,
        `Hi ${appt.customer.first_name}, we regret that your photography session request with Captures By Capri could not be accommodated. Please feel free to reach out to book a new time.`,
        "Your session request from Captures By Capri",
      );
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
    const appt = await loadForAction(res, id, [STATUS.depositRequested]);
    if (!appt) return;
    if (!appt.stripe_deposit_url) { res.status(400).json({ error: "No deposit payment link found" }); return; }
    if (!appt.customer) { res.status(400).json({ error: "No customer associated" }); return; }

    await notifyClient(
      appt.customer,
      `Hi ${appt.customer.first_name}, this is a reminder to complete your deposit with Captures By Capri: ${appt.stripe_deposit_url}`,
      "Reminder: complete your deposit — Captures By Capri",
    );

    req.log.info({ appointmentId: id }, "Deposit reminder sent");
    res.json({ ok: true, paymentUrl: appt.stripe_deposit_url });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to send deposit reminder");
    res.status(500).json({ error: "Failed to send deposit reminder" });
  }
});

// ── Send final invoice ────────────────────────────────────────────────────────

router.post("/appointments/:id/send-final-invoice", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await loadForAction(res, id, [STATUS.depositPaid]);
    if (!appt) return;
    if (!appt.customer) { res.status(400).json({ error: "No customer associated" }); return; }

    const { url: paymentUrl, amountCents } = await issueFinalInvoice(appt);

    await notifyClient(
      appt.customer,
      `Hi ${appt.customer.first_name}! Your final invoice of $${(amountCents / 100).toFixed(2)} for your photography session with Captures By Capri is ready: ${paymentUrl}`,
      "Your final invoice from Captures By Capri",
    );

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
    const appt = await loadForAction(res, id, [STATUS.invoiceSent]);
    if (!appt) return;
    if (!appt.stripe_final_url) { res.status(400).json({ error: "No final invoice found" }); return; }
    if (!appt.customer) { res.status(400).json({ error: "No customer associated" }); return; }

    await notifyClient(
      appt.customer,
      `Hi ${appt.customer.first_name}, this is a reminder to complete your final payment for your Captures By Capri session: ${appt.stripe_final_url}`,
      "Reminder: final payment due — Captures By Capri",
    );

    req.log.info({ appointmentId: id }, "Final invoice reminder sent");
    res.json({ ok: true, paymentUrl: appt.stripe_final_url });
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
    const appt = await loadForAction(res, id, [
      STATUS.invoicePaid,
      STATUS.depositPaid,
    ]);
    if (!appt) return;

    // end_time is a JS Date (mode: "date" in the schema), so this compares dates
    // rather than parsing a non-ISO string.
    if (appt.end_time > new Date()) {
      res.status(400).json({ error: "Appointment has not ended yet" });
      return;
    }

    await updateAppointment(id, { status_id: await getStatusId(STATUS.editing) });

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
  const trimmedUrl = photoUrl.trim();

  try {
    const appt = await loadForAction(res, id, [STATUS.editing]);
    if (!appt) return;
    if (!appt.customer) { res.status(400).json({ error: "No customer associated" }); return; }

    await updateAppointment(id, {
      photo_delivery_url: trimmedUrl,
      status_id: await getStatusId(STATUS.released),
    });

    await notifyClient(
      appt.customer,
      `Hi ${appt.customer.first_name}! Your photos from your session with Captures By Capri are ready. View and download here: ${trimmedUrl}`,
      "Your photos are ready — Captures By Capri",
    );

    req.log.info({ appointmentId: id }, "Photo link sent");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to send photo link");
    res.status(500).json({ error: "Failed to send photo link" });
  }
});

export default router;
