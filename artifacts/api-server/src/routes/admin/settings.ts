import { Router } from "express";
import { isKnownCarrierId, listCarriers } from "../../lib/carrier-lookup";
import { normalizeUsPhoneDigits } from "../../lib/phone";
import { isAdmin } from "../../middleware/auth";
import { getAdminSettings, updateAdminSettings } from "../../repositories/admin-settings";
import { sendAdminTestMessage } from "../../services/notifications";

const router = Router();

router.get("/settings", isAdmin, async (req, res): Promise<void> => {
  try {
    const settings = await getAdminSettings();
    res.json({ ...settings, carriers: listCarriers() });
  } catch (err) {
    req.log.error({ err }, "Failed to load admin settings");
    res.status(500).json({ error: "Failed to load admin settings" });
  }
});

router.put("/settings", isAdmin, async (req, res): Promise<void> => {
  const { admin_phone_number, admin_phone_carrier } = req.body as {
    admin_phone_number?: string;
    admin_phone_carrier?: string;
  };

  if (typeof admin_phone_number !== "string" || !normalizeUsPhoneDigits(admin_phone_number)) {
    res.status(400).json({ error: "admin_phone_number must be a 10-digit US phone number" });
    return;
  }
  if (typeof admin_phone_carrier !== "string" || !isKnownCarrierId(admin_phone_carrier)) {
    res.status(400).json({ error: "admin_phone_carrier must be one of the supported carriers" });
    return;
  }

  try {
    const row = await updateAdminSettings({ admin_phone_number, admin_phone_carrier });
    req.log.info({ carrier: admin_phone_carrier }, "Admin notification settings updated");
    res.json({ ok: true, settings: row });
  } catch (err) {
    req.log.error({ err }, "Failed to save admin settings");
    res.status(500).json({ error: "Failed to save admin settings" });
  }
});

/**
 * Sends a test text using whatever's in the request body — not necessarily
 * what's saved yet — so the admin can verify a number/carrier before hitting
 * Save.
 */
router.post("/settings/test", isAdmin, async (req, res): Promise<void> => {
  const { admin_phone_number, admin_phone_carrier } = req.body as {
    admin_phone_number?: string;
    admin_phone_carrier?: string;
  };

  if (typeof admin_phone_number !== "string" || !normalizeUsPhoneDigits(admin_phone_number)) {
    res.status(400).json({ error: "admin_phone_number must be a 10-digit US phone number" });
    return;
  }
  if (typeof admin_phone_carrier !== "string" || !isKnownCarrierId(admin_phone_carrier)) {
    res.status(400).json({ error: "admin_phone_carrier must be one of the supported carriers" });
    return;
  }

  try {
    const result = await sendAdminTestMessage(admin_phone_number, admin_phone_carrier);
    if (!result.ok) {
      res.status(400).json({ error: result.reason ?? "Could not send test message" });
      return;
    }
    req.log.info({ carrier: admin_phone_carrier }, "Admin test notification sent");
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to send admin test notification");
    res.status(500).json({ error: "Failed to send test message" });
  }
});

export default router;
