import { Router } from "express";
import { isAdmin } from "../../middleware/auth";
import appointmentsRouter from "./appointments";

const router = Router();

router.post("/login", async (req, res): Promise<void> => {
  const { password } = req.body as { password?: string };
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    req.log.error("ADMIN_PASSWORD environment variable is not set");
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  if (!password || password !== adminPassword) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }

  req.session.isAdmin = true;
  res.json({ ok: true });
});

router.post("/logout", isAdmin, (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      req.log.error({ err }, "Failed to destroy session");
      res.status(500).json({ error: "Failed to logout" });
      return;
    }
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

router.get("/me", isAdmin, (_req, res): void => {
  res.json({ ok: true });
});

router.use(appointmentsRouter);

export default router;
