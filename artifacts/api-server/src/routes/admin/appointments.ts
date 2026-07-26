import { Router } from "express";
import { isAdmin } from "../../middleware/auth";
import {
  getAppointment,
  listAppointments,
  setStatus,
} from "../../repositories/appointments";
import { getStatusId, getStatusIds } from "../../repositories/status";

const router = Router();

function parseId(raw: string | string[] | undefined): number {
  const str = Array.isArray(raw) ? raw[0] : raw;
  return parseInt(str ?? "", 10);
}

router.get("/appointments", isAdmin, async (req, res): Promise<void> => {
  const rawStatus = req.query.status;
  const statusNames: string[] = Array.isArray(rawStatus)
    ? (rawStatus as string[]).filter((s) => typeof s === "string")
    : typeof rawStatus === "string"
      ? [rawStatus]
      : [];

  try {
    // Fails closed: if the caller supplies status names and none resolve, return
    // nothing. The Supabase version dropped the filter in that case and returned
    // every appointment, so a typo silently widened the query.
    const statusIds = statusNames.length > 0 ? await getStatusIds(statusNames) : null;
    res.json(await listAppointments(statusIds));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch appointments");
    res.status(500).json({ error: "Failed to fetch appointments" });
  }
});

router.get("/appointments/:id", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid appointment id" });
    return;
  }

  try {
    const appointment = await getAppointment(id);
    if (!appointment) {
      // Now reachable. PostgREST's .single() raised an error on zero rows, so this
      // path used to return 500 and the 404 was dead code.
      res.status(404).json({ error: "Appointment not found" });
      return;
    }
    res.json(appointment);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch appointment");
    res.status(500).json({ error: "Failed to fetch appointment" });
  }
});

router.patch("/appointments/:id/status", isAdmin, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid appointment id" });
    return;
  }

  const { status_name } = req.body as { status_name?: string };
  if (!status_name || typeof status_name !== "string") {
    res.status(400).json({ error: "status_name is required" });
    return;
  }

  let statusId: number;
  try {
    statusId = await getStatusId(status_name);
  } catch {
    res.status(400).json({ error: `Unknown status: ${status_name}` });
    return;
  }

  try {
    await setStatus(id, statusId);
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to update appointment status");
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
