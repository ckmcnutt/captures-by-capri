import { Router, type Response } from "express";
import { declineCalBooking } from "../../lib/calcom";
import { createCheckoutSession } from "../../lib/stripe";
import { isAdmin } from "../../middleware/auth";
import { PRICING_KIND } from "../../repositories/pricing";
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

function parseAmount(body: unknown): number | null {
  const { amount } = (body ?? {}) as { amount?: unknown };
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

/**
 * Load an appointment and assert its current state, replying with the right
 * error if anything is off.
 *
 * `check` inspects the fetched appointment (status name plus the
 * deposit/invoice booleans) and returns an error message, or null if the
 * action may proceed. Centralising this means every handler below gets a
 * consistent 404 and 400 shape without repeating the fetch.
 *
 * Returns null when a response has already been sent.
 */
async function loadForAction(
  res: Response,
  id: number,
  check: (appt: NonNullable<AppointmentDetail>) => string | null,
): Promise<NonNullable<AppointmentDetail> | null> {
  const appointment = await getAppointment(id);

  if (!appointment) {
    res.status(404).json({ error: "Appointment not found" });
    return null;
  }

  const error = check(appointment);
  if (error) {
    res.status(400).json({ error });
    return null;
  }

  return appointment;
}

function statusOf(appt: NonNullable<AppointmentDetail>): string | null {
  return appt.appointment_status?.status_name ?? null;
}

// ── Confirm ──────────────────────────────────────────────────────────────────

router.post("/appointments/:id/confirm", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  // The admin panel shows a popup to pick this amount (prefilled from the
  // settings-page default) before ever calling this route, so there's no
  // pricing_config fallback here — an appointment's deposit amount is always
  // a deliberate, explicit choice.
  const amount = parseAmount(req.body);
  if (amount === null) { res.status(400).json({ error: "amount must be a positive number" }); return; }

  try {
    const appt = await loadForAction(res, id, (a) => {
      if (statusOf(a) !== STATUS.requested) {
        return `Cannot perform this action on an appointment in status: ${statusOf(a)}`;
      }
      if (a.deposit_requested) return "A deposit has already been requested for this appointment";
      return null;
    });
    if (!appt) return;
    if (!appt.customer) { res.status(400).json({ error: "No customer associated" }); return; }

    const { sessionId, url: paymentUrl } = await createCheckoutSession(
      PRICING_KIND.deposit,
      id,
      Math.round(amount * 100),
    );

    await updateAppointment(id, {
      stripe_deposit_invoice_id: sessionId,
      stripe_deposit_url: paymentUrl,
      deposit_amount: amount,
      deposit_requested: true,
    });

    await notifyClient(
      appt.customer,
      `Hi ${appt.customer.first_name}! Your photography session request with Captures By Capri has been reviewed. Complete your $${amount.toFixed(2)} deposit here: ${paymentUrl}`,
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
    const appt = await loadForAction(res, id, (a) => {
      if (statusOf(a) !== STATUS.requested) {
        return `Cannot perform this action on an appointment in status: ${statusOf(a)}`;
      }
      if (a.deposit_requested) return "Cannot reject an appointment once a deposit has been requested";
      return null;
    });
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
    const appt = await loadForAction(res, id, (a) => {
      if (!a.deposit_requested) return "No deposit has been requested for this appointment";
      if (a.deposit_paid) return "The deposit has already been paid";
      return null;
    });
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

// ── Regenerate deposit link ─────────────────────────────────────────────────────

router.post("/appointments/:id/regenerate-deposit-link", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  const amount = parseAmount(req.body);
  if (amount === null) { res.status(400).json({ error: "amount must be a positive number" }); return; }

  try {
    const appt = await loadForAction(res, id, (a) => {
      if (!a.deposit_requested) return "No deposit has been requested for this appointment";
      if (a.deposit_paid) return "The deposit has already been paid";
      return null;
    });
    if (!appt) return;

    const { sessionId, url: paymentUrl } = await createCheckoutSession(
      PRICING_KIND.deposit,
      id,
      Math.round(amount * 100),
    );

    await updateAppointment(id, {
      stripe_deposit_invoice_id: sessionId,
      stripe_deposit_url: paymentUrl,
      deposit_amount: amount,
    });

    req.log.info({ appointmentId: id }, "Deposit link regenerated");
    res.json({ ok: true, paymentUrl });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to regenerate deposit link");
    res.status(500).json({ error: "Failed to regenerate deposit link" });
  }
});

// ── Set final invoice amount ────────────────────────────────────────────────────

/**
 * Lets the admin override the final invoice amount from the appointment
 * panel any time before it's actually sent — manually here, or by the T-2d
 * scheduled job. issueFinalInvoice() (services/final-invoice.ts) prefers this
 * value over the duration-tier default whenever it's set.
 */
router.patch("/appointments/:id/final-invoice-amount", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  const amount = parseAmount(req.body);
  if (amount === null) { res.status(400).json({ error: "amount must be a positive number" }); return; }

  try {
    const appt = await loadForAction(res, id, (a) => {
      if (a.invoice_sent) return "The final invoice has already been sent — its amount can no longer be changed here";
      return null;
    });
    if (!appt) return;

    await updateAppointment(id, { final_invoice_amount: amount });

    req.log.info({ appointmentId: id, amount }, "Final invoice amount set");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to set final invoice amount");
    res.status(500).json({ error: "Failed to set final invoice amount" });
  }
});

// ── Send final invoice ────────────────────────────────────────────────────────

router.post("/appointments/:id/send-final-invoice", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await loadForAction(res, id, (a) => {
      if (statusOf(a) !== STATUS.confirmed) {
        return `Cannot perform this action on an appointment in status: ${statusOf(a)}`;
      }
      if (!a.deposit_paid) return "The deposit hasn't been paid yet";
      if (a.invoice_sent) return "A final invoice has already been sent";
      return null;
    });
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
    const appt = await loadForAction(res, id, (a) => {
      if (!a.invoice_sent) return "No final invoice has been sent for this appointment";
      if (a.invoice_paid) return "The final invoice has already been paid";
      return null;
    });
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

// ── Mark complete ──────────────────────────────────────────────────────────────

router.post("/appointments/:id/complete", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid appointment id" }); return; }

  try {
    const appt = await loadForAction(res, id, (a) => {
      if (statusOf(a) !== STATUS.confirmed) {
        return `Cannot perform this action on an appointment in status: ${statusOf(a)}`;
      }
      if (!a.invoice_paid) return "The final invoice hasn't been paid yet";
      return null;
    });
    if (!appt) return;

    // end_time is a JS Date (mode: "date" in the schema), so this compares dates
    // rather than parsing a non-ISO string.
    if (appt.end_time > new Date()) {
      res.status(400).json({ error: "Appointment has not ended yet" });
      return;
    }

    await updateAppointment(id, { status_id: await getStatusId(STATUS.complete) });

    req.log.info({ appointmentId: id }, "Appointment marked complete");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err, appointmentId: id }, "Failed to mark appointment complete");
    res.status(500).json({ error: "Failed to mark appointment complete" });
  }
});

export default router;
