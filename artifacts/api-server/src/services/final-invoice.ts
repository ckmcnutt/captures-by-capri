import { createCheckoutSession } from "../lib/stripe";
import { durationTier } from "../lib/time";
import { getPricingByKind } from "../repositories/pricing";
import { updateAppointment } from "../repositories/appointments";

export interface FinalInvoiceAppointment {
  id: number;
  start_time: Date;
  end_time: Date;
  final_invoice_amount: number | null;
}

/**
 * Issue the final invoice for an appointment: use whatever amount the admin
 * already set on the appointment (via the appointment panel's final invoice
 * field), or fall back to the 30min/1hr price tier default from the admin
 * settings page if they haven't. Creates a one-time Stripe Checkout Session
 * for that amount and records it on the appointment.
 *
 * Shared by the manual "Send Final Invoice" admin action and the T-2d
 * scheduled job, so the tier/override/URL/DB-write logic exists exactly once.
 */
export async function issueFinalInvoice(
  appointment: FinalInvoiceAppointment,
): Promise<{ url: string; amountCents: number }> {
  const tier = durationTier(appointment.start_time, appointment.end_time);

  let amountCents: number;
  if (appointment.final_invoice_amount != null) {
    amountCents = Math.round(appointment.final_invoice_amount * 100);
  } else {
    const config = await getPricingByKind(tier);
    if (!config) {
      throw new Error(
        `Final invoice pricing for "${tier}" is not configured yet — set it on the admin settings page first.`,
      );
    }
    amountCents = config.amount_cents;
  }

  const { sessionId, url } = await createCheckoutSession(tier, appointment.id, amountCents);

  await updateAppointment(appointment.id, {
    stripe_final_invoice_id: sessionId,
    stripe_final_url: url,
    final_invoice_amount: amountCents / 100,
    invoice_sent: true,
  });

  return { url, amountCents };
}
