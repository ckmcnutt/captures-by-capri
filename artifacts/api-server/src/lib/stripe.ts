import Stripe from "stripe";
import { logger } from "./logger";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  logger.warn("STRIPE_SECRET_KEY is not set — Stripe features will be unavailable");
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: "2026-05-27.dahlia" })
  : null;

async function createPaymentLink(
  appointmentId: number,
  amountCents: number,
  productName: string,
  invoiceType: "deposit" | "final"
): Promise<{ url: string; id: string }> {
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
    metadata: {
      appointmentId: String(appointmentId),
      invoiceType,
    },
  });

  return { url: paymentLink.url, id: paymentLink.id };
}

export async function createDepositPaymentLink(
  appointmentId: number
): Promise<{ url: string; id: string }> {
  const result = await createPaymentLink(appointmentId, 2000, "Photography Session Deposit", "deposit");
  logger.info({ appointmentId, paymentLinkId: result.id }, "Stripe deposit payment link created");
  return result;
}

export async function createFinalPaymentLink(
  appointmentId: number,
  amountCents: number
): Promise<{ url: string; id: string }> {
  const result = await createPaymentLink(appointmentId, amountCents, "Photography Session Final Invoice", "final");
  logger.info({ appointmentId, amountCents, paymentLinkId: result.id }, "Stripe final payment link created");
  return result;
}
