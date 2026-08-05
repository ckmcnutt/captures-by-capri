import { Router } from "express";
import { isAdmin } from "../../middleware/auth";
import {
  getAllPricing,
  getPricingByKind,
  isPricingKind,
  updatePricingByKind,
} from "../../repositories/pricing";

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
    await updatePricingByKind(kind, Math.round(amount * 100));
    const config = await getPricingByKind(kind);
    req.log.info({ kind, amount }, "Default pricing updated");
    res.json({ ok: true, config });
  } catch (err) {
    req.log.error({ err, kind }, "Failed to update pricing");
    res.status(500).json({ error: "Failed to update pricing" });
  }
});

export default router;
