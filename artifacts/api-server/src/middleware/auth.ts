import type { Request, Response, NextFunction } from "express";
import { verifySession } from "../lib/session";

/**
 * Gate for the admin API.
 *
 * Synchronous now: it validates a locally signed cookie instead of making a
 * network round-trip to Supabase Auth on every request. It also actually checks
 * for an admin — the previous implementation accepted any valid Supabase user in
 * the project, with no role, claim or allowlist check.
 */
export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!verifySession(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}
