import { appendClientReference } from "../lib/stripe";
import { durationTier } from "../lib/time";
import { getPricingByKind } from "../repositories/pricing";
import { updateAppointment } from "../repositories/appointments";
import { getStatusId, STATUS } from "../repositories/status";

export interface FinalInvoiceAppointment {
  id: number;
  start_time: Date;
  end_time: Date;
}

/**
 * Issue the final invoice for an appointment: pick the 30min/1hr price tier
 * from its duration, build a per-appointment link off the shared persistent
 * Payment Link for that tier, and record it on the appointment.
 *
 * Shared by the manual "Send Final Invoice" admin action and the T-2d
 * scheduled job, so the tier/URL/DB-write logic exists exactly once.
 */
export async function issueFinalInvoice(
  appointment: FinalInvoiceAppointment,
): Promise<{ url: string; amountCents: number }> {
  const tier = durationTier(appointment.start_time, appointment.end_time);
  const config = await getPricingByKind(tier);

  if (!config?.stripe_payment_link_url || !config.stripe_payment_link_id) {
    throw new Error(
      `Final invoice pricing for "${tier}" is not configured yet — set it on the admin pricing page first.`,
    );
  }

  const url = appendClientReference(config.stripe_payment_link_url, appointment.id);

  await updateAppointment(appointment.id, {
    stripe_final_invoice_id: config.stripe_payment_link_id,
    stripe_final_url: url,
    final_invoice_amount: config.amount_cents / 100,
    status_id: await getStatusId(STATUS.invoiceSent),
  });

  return { url, amountCents: config.amount_cents };
}
