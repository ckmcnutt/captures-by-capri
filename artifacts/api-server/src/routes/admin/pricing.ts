import { Router } from "express";
import { isAdmin } from "../../middleware/auth";
import { getAllPricing, isPricingKind } from "../../repositories/pricing";
import { regeneratePricing } from "../../services/pricing-admin";

const router = Router();

router.get("/pricing", isAdmin, async (req, res): Promise<void> => {
  try {
    const rows = await getAllPricing();
    res.json(rows);
  } catch (err) {
    req.log.error({ err }, "Failed to load pricing config");
    res.status(500).json({ error: "Failed to load pricing config" });
  }
});

router.put("/pricing/:kind", isAdmin, async (req, res): Promise<void> => {
  const kind = Array.isArray(req.params.kind) ? req.params.kind[0] : req.params.kind;
  if (!kind || !isPricingKind(kind)) {
    res.status(400).json({ error: `Unknown pricing kind: ${kind}` });
    return;
  }

  const { amount } = req.body as { amount?: number };
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: "amount must be a positive number" });
    return;
  }

  try {
    const config = await regeneratePricing(kind, Math.round(amount * 100));
    req.log.info({ kind, amount }, "Pricing regenerated");
    res.json({ ok: true, config });
  } catch (err) {
    req.log.error({ err, kind }, "Failed to regenerate pricing");
    res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to regenerate pricing",
    });
  }
});

export default router;
