import { Router } from "express";
import { supabase } from "../../lib/supabase";
import { isAdmin } from "../../middleware/auth";

const router = Router();

router.get("/appointments", isAdmin, async (req, res): Promise<void> => {
  const rawStatus = req.query.status;
  const statusNames: string[] = Array.isArray(rawStatus)
    ? (rawStatus as string[]).filter((s) => typeof s === "string")
    : typeof rawStatus === "string"
    ? [rawStatus]
    : [];

  let query = supabase
    .from("appointment")
    .select(
      `id, start_time, end_time, aesthetic, customer_notes, internal_notes,
       cal_booking_uid, stripe_deposit_invoice_id, stripe_deposit_url,
       stripe_final_invoice_id, stripe_final_url,
       final_invoice_amount, photo_delivery_url, created_at,
       customer:customer_id ( id, first_name, last_name, email_address, phone_number, preferred_contact_method ),
       category:category_id ( id, category_name, category_desc ),
       appointment_status:status_id ( id, status_name, status_desc )`
    )
    .order("start_time", { ascending: false });

  if (statusNames.length > 0) {
    const { data: statusRows } = await supabase
      .from("appointment_status")
      .select("id")
      .in("status_name", statusNames);
    if (statusRows && statusRows.length > 0) {
      query = query.in("status_id", statusRows.map((r) => r.id));
    }
  }

  const { data, error } = await query;
  if (error) {
    req.log.error({ err: error }, "Failed to fetch appointments");
    res.status(500).json({ error: "Failed to fetch appointments" });
    return;
  }

  res.json(data);
});

router.get("/appointments/:id", isAdmin, async (req, res): Promise<void> => {
  const rawId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(rawId, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid appointment id" });
    return;
  }

  const { data, error } = await supabase
    .from("appointment")
    .select(
      `id, start_time, end_time, aesthetic, customer_notes, internal_notes,
       cal_booking_uid, stripe_deposit_invoice_id, stripe_deposit_url,
       stripe_final_invoice_id, stripe_final_url,
       final_invoice_amount, photo_delivery_url, created_at,
       customer:customer_id ( id, first_name, last_name, email_address, phone_number, preferred_contact_method ),
       category:category_id ( id, category_name, category_desc ),
       appointment_status:status_id ( id, status_name, status_desc )`
    )
    .eq("id", id)
    .single();

  if (error) {
    req.log.error({ err: error }, "Failed to fetch appointment");
    res.status(500).json({ error: "Failed to fetch appointment" });
    return;
  }

  if (!data) {
    res.status(404).json({ error: "Appointment not found" });
    return;
  }

  res.json(data);
});

export default router;
