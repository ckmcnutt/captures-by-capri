import crypto from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../env";

/**
 * Admin sessions: a single shared password from the environment, exchanged for a
 * signed httpOnly cookie.
 *
 * This replaces Supabase Auth, and closes a real hole while doing so — the old
 * `isAdmin` accepted ANY valid Supabase user in the project, with no role, claim
 * or allowlist check.
 */
const COOKIE_NAME = "capri_admin";
const SUBJECT = "admin";

function sha256(value: string): Buffer {
  return crypto.createHash("sha256").update(value, "utf8").digest();
}

/**
 * Constant-time password comparison.
 *
 * Both sides are hashed first so the buffers are always 32 bytes:
 * `timingSafeEqual` throws on length mismatch, and comparing lengths beforehand
 * would itself leak the password length.
 */
export function checkPassword(supplied: unknown): boolean {
  if (typeof supplied !== "string" || supplied.length === 0) return false;
  return crypto.timingSafeEqual(sha256(supplied), sha256(env.ADMIN_PASSWORD));
}

function ttlMs(): number {
  return env.SESSION_TTL_HOURS * 3_600_000;
}

/**
 * Issue a session cookie.
 *
 * The expiry is baked into the signed value, not just the Max-Age attribute, so a
 * client cannot extend its own session by editing the cookie — the HMAC covers
 * the timestamp.
 */
export function issueSession(res: Response): void {
  const expiresAt = Date.now() + ttlMs();
  res.cookie(COOKIE_NAME, `${SUBJECT}.${expiresAt}`, {
    signed: true,
    httpOnly: true,
    // Blocks cross-site POSTs, which is the CSRF defence for the admin action
    // endpoints. Safe here because the SPA is same-origin in both dev and prod.
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: ttlMs(),
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
  });
}

/** True when the request carries a validly signed, unexpired admin cookie. */
export function verifySession(req: Request): boolean {
  // cookie-parser puts a tampered cookie's value as `false` in signedCookies.
  const raw = req.signedCookies?.[COOKIE_NAME];
  if (typeof raw !== "string") return false;

  const separator = raw.lastIndexOf(".");
  if (separator === -1) return false;

  const subject = raw.slice(0, separator);
  const expiresAt = Number(raw.slice(separator + 1));

  if (subject !== SUBJECT) return false;
  if (!Number.isFinite(expiresAt)) return false;

  return expiresAt > Date.now();
}
