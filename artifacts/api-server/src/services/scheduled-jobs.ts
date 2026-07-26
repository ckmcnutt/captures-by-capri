import type { Logger } from "pino";
import { cancelCalBooking } from "../lib/calcom";
import { createFinalPaymentLink } from "../lib/stripe";
import { daysUntil } from "../lib/time";
import {
  listByStatusForJobs,
  updateAppointment,
  type JobAppointment,
} from "../repositories/appointments";
import { STATUS, getStatusId } from "../repositories/status";
import { notifyAdmin, notifyClient } from "./notifications";

/**
 * Time-based appointment workflow, ported from the Supabase edge function
 * `scheduled-jobs`.
 *
 * Windows (each a full 24 hours wide, hence the daily-only cron):
 *   deposit_paid, T-3d, no price set  -> nag the photographer
 *   deposit_paid, T-2d, price set     -> create + send the final invoice
 *   invoice_sent, T-1d                -> remind the client, warn the photographer
 *   invoice_sent, past start          -> cancel the appointment and the booking
 *
 * Fixed while porting:
 *   1. stripe_final_url is now written. The edge function saved only
 *      stripe_final_invoice_id, so scheduler-issued invoices showed a blank URL in
 *      the dashboard while dashboard-issued ones did not.
 *   2. Uses lib/stripe.ts instead of a second, raw-REST Stripe implementation.
 *   3. Email notifications actually send. All three email branches were
 *      `console.info(...)` — the feature had never been implemented.
 */

export interface ScheduledJobsResult {
  processed: number;
  errors: string[];
}

export async function runScheduledJobs(
  log: Logger,
): Promise<ScheduledJobsResult> {
  const errors: string[] = [];
  let processed = 0;

  const [depositPaidId, invoiceSentId, canceledId] = await Promise.all([
    getStatusId(STATUS.depositPaid),
    getStatusId(STATUS.invoiceSent),
    getStatusId(STATUS.canceled),
  ]);

  // ── deposit_paid ──────────────────────────────────────────────────────────
  try {
    const appointments = await listByStatusForJobs(depositPaidId);
    log.info({ count: appointments.length }, "Processing deposit_paid appointments");

    for (const appt of appointments) {
      try {
        if (await handleDepositPaid(appt, invoiceSentId, log)) processed++;
      } catch (err) {
        const msg = `deposit_paid appt #${appt.id}: ${errorText(err)}`;
        log.error({ err, appointmentId: appt.id }, "Scheduled job step failed");
        errors.push(msg);
      }
    }
  } catch (err) {
    const msg = `Failed to fetch deposit_paid appointments: ${errorText(err)}`;
    log.error({ err }, msg);
    errors.push(msg);
  }

  // ── invoice_sent ──────────────────────────────────────────────────────────
  try {
    const appointments = await listByStatusForJobs(invoiceSentId);
    log.info({ count: appointments.length }, "Processing invoice_sent appointments");

    for (const appt of appointments) {
      try {
        if (await handleInvoiceSent(appt, canceledId, log)) processed++;
      } catch (err) {
        const msg = `invoice_sent appt #${appt.id}: ${errorText(err)}`;
        log.error({ err, appointmentId: appt.id }, "Scheduled job step failed");
        errors.push(msg);
      }
    }
  } catch (err) {
    const msg = `Failed to fetch invoice_sent appointments: ${errorText(err)}`;
    log.error({ err }, msg);
    errors.push(msg);
  }

  return { processed, errors };
}

/** Returns true when the appointment was acted on. */
async function handleDepositPaid(
  appt: JobAppointment,
  invoiceSentId: number,
  log: Logger,
): Promise<boolean> {
  const days = daysUntil(appt.start_time);

  // T-3d with no price set: nudge the photographer.
  if (days <= 3 && days > 2 && !appt.final_invoice_amount) {
    await notifyAdmin(
      `Reminder: Appointment #${appt.id} is in 3 days and has no final invoice amount set.`,
    );
    log.info({ appointmentId: appt.id }, "Admin nudged: no final price set");
    return true;
  }

  // T-2d with a price set: create and send the final invoice.
  if (days <= 2 && days > 1 && appt.final_invoice_amount) {
    const amountCents = Math.round(appt.final_invoice_amount * 100);
    const { url, id } = await createFinalPaymentLink(appt.id, amountCents);

    await updateAppointment(appt.id, {
      stripe_final_invoice_id: id,
      // Written here, unlike the edge function — the dashboard renders this.
      stripe_final_url: url,
      status_id: invoiceSentId,
    });

    if (appt.customer) {
      await notifyClient(
        appt.customer,
        `Hi ${appt.customer.first_name}! Your final invoice for your photography session is ready: ${url}`,
        "Your final invoice from Captures By Capri",
      );
    } else {
      log.warn({ appointmentId: appt.id }, "No customer to notify of final invoice");
    }

    log.info({ appointmentId: appt.id, amountCents }, "Final invoice sent");
    return true;
  }

  return false;
}

/** Returns true when the appointment was acted on. */
async function handleInvoiceSent(
  appt: JobAppointment,
  canceledId: number,
  log: Logger,
): Promise<boolean> {
  const days = daysUntil(appt.start_time);

  // T-1d and still unpaid: remind the client, warn the photographer.
  if (days <= 1 && days > 0) {
    if (appt.customer) {
      await notifyClient(
        appt.customer,
        `Hi ${appt.customer.first_name}, your photography session is tomorrow! ` +
          `Please complete your final invoice payment as soon as possible to keep your session.`,
        "Your session is tomorrow — payment required",
      );
    }
    await notifyAdmin(
      `Warning: Appointment #${appt.id} is tomorrow but invoice is still unpaid.`,
    );
    log.info({ appointmentId: appt.id }, "Unpaid-invoice reminders sent");
    return true;
  }

  // Start time passed without payment: cancel.
  if (days <= 0) {
    await updateAppointment(appt.id, {
      status_id: canceledId,
      internal_notes: "Canceled: invoice not paid by appointment time",
    });

    if (appt.cal_booking_uid) {
      // A Cal.com failure must not undo the status change above, so it is caught
      // separately rather than aborting this appointment's handling.
      try {
        await cancelCalBooking(
          appt.cal_booking_uid,
          "Invoice not paid by appointment time",
        );
      } catch (err) {
        log.error(
          { err, appointmentId: appt.id, uid: appt.cal_booking_uid },
          "Failed to cancel the Cal.com booking; appointment is still canceled locally",
        );
      }
    }

    if (appt.customer) {
      await notifyClient(
        appt.customer,
        `Hi ${appt.customer.first_name}, your photography session with Captures By Capri ` +
          `has been canceled due to an unpaid invoice. Please contact us to reschedule.`,
        "Your session has been canceled",
      );
    }

    log.info({ appointmentId: appt.id }, "Appointment canceled: invoice unpaid");
    return true;
  }

  return false;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
