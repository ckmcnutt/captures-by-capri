import { createPersistentPriceAndLink } from "../lib/stripe";
import {
  getPricingByKind,
  updatePricingByKind,
  type PricingKind,
} from "../repositories/pricing";
import type { PricingConfigRow } from "../db/schema";

const PRODUCT_NAMES: Record<PricingKind, string> = {
  deposit: "Photography Session Deposit",
  final_30: "Photography Session Final Invoice (30 min)",
  final_60: "Photography Session Final Invoice (1 hr)",
};

// Per-kind re-entrancy guard: a double-click on Save shouldn't create two
// Stripe Prices/Links for the same kind in quick succession.
const regenerating = new Set<PricingKind>();

/**
 * Regenerate the persistent Stripe Price + Payment Link for one pricing kind
 * and make it the new default for every future confirm/send-final-invoice
 * call. Deliberately does not touch existing appointments or deactivate the
 * previous link — see docs/plan for why.
 */
export async function regeneratePricing(
  kind: PricingKind,
  amountCents: number,
): Promise<PricingConfigRow> {
  if (regenerating.has(kind)) {
    throw new Error(`Pricing for "${kind}" is already being updated — try again shortly.`);
  }

  regenerating.add(kind);
  try {
    const { priceId, linkId, url } = await createPersistentPriceAndLink(
      kind,
      amountCents,
      PRODUCT_NAMES[kind],
    );

    await updatePricingByKind(kind, {
      amount_cents: amountCents,
      stripe_price_id: priceId,
      stripe_payment_link_id: linkId,
      stripe_payment_link_url: url,
    });

    const updated = await getPricingByKind(kind);
    if (!updated) throw new Error(`Pricing row for "${kind}" disappeared after update`);
    return updated;
  } finally {
    regenerating.delete(kind);
  }
}
