import { Router } from "express";
import { supabase } from "../lib/supabase";

const router = Router();

router.get("/portfolio", async (req, res): Promise<void> => {
  const { data, error } = await supabase
    .from("photo")
    .select("id, url, title, category:category_id(category_name)")
    .eq("featured_portfolio", true)
    .order("id");

  if (error) {
    req.log.error({ err: error }, "Failed to fetch portfolio photos");
    res.status(500).json({ error: "Failed to fetch portfolio photos" });
    return;
  }

  res.json(data ?? []);
});

export default router;
