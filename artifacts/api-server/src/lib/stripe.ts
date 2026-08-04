import Stripe from "stripe";
import { env } from "../env";
import type { PricingKind } from "../repositories/pricing";
import { logger } from "./logger";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  logger.warn("STRIPE_SECRET_KEY is not set — Stripe features will be unavailable");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-05-27.dahlia" })
  : null;

const PRODUCT_NAMES: Record<PricingKind, string> = {
  deposit: "Photography Session Deposit",
  final_30: "Photography Session Final Invoice (30 min)",
  final_60: "Photography Session Final Invoice (1 hr)",
};

/**
 * Create a one-time Stripe Checkout Session for a single appointment's
 * deposit or final invoice, at whatever amount was decided for this specific
 * appointment (an admin-set deposit amount, or a possibly admin-overridden
 * final invoice amount — see routes/admin/actions.ts and
 * services/final-invoice.ts). There's no persistent Price/Payment Link
 * anymore — see git history if you need the shared-link version back.
 *
 * `client_reference_id` and `metadata.kind` on the session, plus mirrored
 * metadata on the underlying PaymentIntent (Stripe does not copy session
 * metadata onto it automatically), are how the webhook recovers which
 * appointment and which invoice type a completed payment belongs to —
 * see routes/webhooks/stripe.ts#resolveCheckoutSession.
 */
export async function createCheckoutSession(
  kind: PricingKind,
  appointmentId: number,
  amountCents: number,
): Promise<{ sessionId: string; url: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }
  if (!env.SITE_URL) {
    throw new Error("SITE_URL is not configured — required for Stripe Checkout redirect URLs");
  }

  const invoiceType = kind === "deposit" ? "deposit" : "final";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: amountCents,
          product_data: { name: PRODUCT_NAMES[kind] },
        },
        quantity: 1,
      },
    ],
    client_reference_id: String(appointmentId),
    metadata: { kind, appointmentId: String(appointmentId) },
    payment_intent_data: {
      metadata: { appointmentId: String(appointmentId), invoiceType },
    },
    success_url: `${env.SITE_URL}/?payment=success`,
    cancel_url: `${env.SITE_URL}/?payment=cancelled`,
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout Session URL");
  }

  logger.info(
    { kind, appointmentId, amountCents, sessionId: session.id },
    "Stripe Checkout Session created",
  );

  return { sessionId: session.id, url: session.url };
}
