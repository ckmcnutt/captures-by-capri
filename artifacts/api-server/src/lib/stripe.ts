import Stripe from "stripe";
import type { PricingKind } from "../repositories/pricing";
import { logger } from "./logger";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  logger.warn("STRIPE_SECRET_KEY is not set — Stripe features will be unavailable");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-05-27.dahlia" })
  : null;

/**
 * Create one persistent Stripe Price + Payment Link for a pricing kind
 * (`deposit` | `final_30` | `final_60`).
 *
 * Unlike the old per-appointment links, this is called only from the admin
 * pricing page when a price changes — the resulting link is shared by every
 * appointment confirmed/invoiced afterwards, until the next price change. The
 * previous Price/Link for this kind is deliberately left active: appointments
 * created while it was current keep referencing it indefinitely (see
 * repositories/pricing.ts callers).
 *
 * `metadata.kind` on the Payment Link propagates to the resulting Checkout
 * Session's metadata, which is how the webhook recovers deposit-vs-final
 * without a database round trip.
 */
export async function createPersistentPriceAndLink(
  kind: PricingKind,
  amountCents: number,
  productName: string,
): Promise<{ priceId: string; linkId: string; url: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: amountCents,
    product_data: { name: productName },
  });

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { kind },
  });

  logger.info(
    { kind, amountCents, priceId: price.id, paymentLinkId: paymentLink.id },
    "Stripe persistent payment link created",
  );

  return { priceId: price.id, linkId: paymentLink.id, url: paymentLink.url };
}

/**
 * Attach an appointment id to a shared payment link URL so the webhook can
 * tell which appointment a given checkout belongs to. Stripe threads this
 * through to the resulting Checkout Session as `client_reference_id`.
 */
export function appendClientReference(url: string, appointmentId: number): string {
  const withParam = new URL(url);
  withParam.searchParams.set("client_reference_id", String(appointmentId));
  return withParam.toString();
}
