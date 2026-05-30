import type { Request, Response, NextFunction } from "express";

export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.session?.isAdmin) {
    next();
    return;
  }
  res.status(401).json({ error: "Unauthorized" });
}
