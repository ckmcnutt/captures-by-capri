import type { Request, Response, NextFunction } from "express";

/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * The login endpoint is an unauthenticated oracle for a single shared password,
 * so it needs a brake. A single-admin app on one host doesn't justify pulling in
 * express-rate-limit or a Redis store — but if this ever runs multi-process, the
 * per-process counter stops being a real limit and should be replaced.
 */
interface Options {
  /** Max attempts allowed inside the window. */
  max: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export function rateLimit({ max, windowMs }: Options) {
  const hits = new Map<string, number[]>();

  return function rateLimiter(
    req: Request,
    res: Response,
    next: NextFunction,
  ): void {
    const key = req.ip ?? "unknown";
    const now = Date.now();

    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);

    if (recent.length >= max) {
      const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      req.log.warn({ ip: key }, "Rate limit exceeded");
      res.status(429).json({ error: "Too many attempts. Try again later." });
      return;
    }

    recent.push(now);
    hits.set(key, recent);

    // Opportunistic cleanup so the map can't grow without bound.
    if (hits.size > 1000) {
      for (const [k, times] of hits) {
        if (times.every((t) => now - t >= windowMs)) hits.delete(k);
      }
    }

    next();
  };
}
