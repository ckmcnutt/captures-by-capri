import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { pricing_config, type PricingConfigRow } from "../db/schema";

/**
 * The fixed set of persistent payment-link kinds this app sends. Centralised
 * here for the same reason repositories/status.ts centralises STATUS: one
 * source of truth for the literal strings used across routes/services.
 */
export const PRICING_KIND = {
  deposit: "deposit",
  final30: "final_30",
  final60: "final_60",
} as const;

export type PricingKind = (typeof PRICING_KIND)[keyof typeof PRICING_KIND];

export function isPricingKind(value: string): value is PricingKind {
  return (Object.values(PRICING_KIND) as string[]).includes(value);
}

export async function getAllPricing(): Promise<PricingConfigRow[]> {
  return db.select().from(pricing_config);
}

export async function getPricingByKind(
  kind: PricingKind,
): Promise<PricingConfigRow | undefined> {
  const [row] = await db
    .select()
    .from(pricing_config)
    .where(eq(pricing_config.kind, kind))
    .limit(1);
  return row;
}

export async function updatePricingByKind(
  kind: PricingKind,
  values: {
    amount_cents: number;
    stripe_price_id: string;
    stripe_payment_link_id: string;
    stripe_payment_link_url: string;
  },
): Promise<void> {
  await db
    .update(pricing_config)
    .set({ ...values, updated_at: new Date() })
    .where(eq(pricing_config.kind, kind));
}
