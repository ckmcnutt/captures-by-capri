import Stripe from "stripe";
import { logger } from "./logger";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  logger.warn("STRIPE_SECRET_KEY is not set — Stripe features will be unavailable");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-05-27.dahlia" })
  : null;

export async function createDepositPaymentLink(
  appointmentId: number
): Promise<{ url: string; id: string }> {
  if (!stripe) {
    throw new Error("Stripe is not configured (STRIPE_SECRET_KEY missing)");
  }

  const price = await stripe.prices.create({
    currency: "usd",
    unit_amount: 2000,
    product_data: {
      name: "Photography Session Deposit",
    },
  });

  const paymentLink = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: {
      appointmentId: String(appointmentId),
      invoiceType: "deposit",
    },
  });

  logger.info({ appointmentId, paymentLinkId: paymentLink.id }, "Stripe deposit payment link created");

  return { url: paymentLink.url, id: paymentLink.id };
}
