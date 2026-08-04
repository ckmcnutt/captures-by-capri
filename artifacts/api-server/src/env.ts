import path from "node:path";
import { config as loadEnv } from "dotenv";
import { z } from "zod";

/**
 * The single place environment variables are read and validated.
 *
 * Import this FIRST in index.ts — db/client.ts reads env.DATABASE_URL at module
 * scope, so anything that loads the DB client before this has run gets undefined.
 *
 * The repo root is three levels up from both `src/` (tsx dev) and `dist/`
 * (compiled), so one resolution covers both:
 *   artifacts/api-server/{src,dist} -> artifacts/api-server -> artifacts -> root
 */
export const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");

// override: false so real process env (e.g. systemd EnvironmentFile) always wins.
loadEnv({ path: path.join(REPO_ROOT, ".env"), override: false });

/**
 * Env vars are always strings, so `z.coerce.boolean()` is a trap:
 * `Boolean("false") === true`, which would silently turn SERVE_STATIC=false
 * into true. Parse the actual words instead.
 */
const boolFromEnv = (defaultValue: boolean) =>
  z
    .enum(["true", "false", "1", "0", "yes", "no", "on", "off"])
    .default(defaultValue ? "true" : "false")
    .transform((v) => v === "true" || v === "1" || v === "yes" || v === "on");

/**
 * Directory paths, resolved against the repo root rather than process.cwd().
 *
 * cwd differs between `pnpm --filter ... dev` (artifacts/api-server) and a
 * systemd unit, so a relative `MEDIA_DIR=./media` would otherwise point at
 * different places — and silently 404 every image.
 */
const dirFromEnv = (defaultValue: string) =>
  z
    .string()
    .default(defaultValue)
    .transform((v) => (path.isAbsolute(v) ? v : path.resolve(REPO_ROOT, v)));

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default("info"),
  // Baked in at Docker build time (see Dockerfile's GIT_COMMIT build arg).
  // "unknown" for `pnpm dev`, which runs straight from source, not an image.
  GIT_COMMIT: z.string().default("unknown"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Admin auth. Single shared password, exchanged for a signed session cookie.
  ADMIN_PASSWORD: z
    .string()
    .min(12, "ADMIN_PASSWORD must be at least 12 characters"),
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters (openssl rand -hex 32)"),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),

  // Static assets. Relative values are resolved against the repo root.
  MEDIA_DIR: dirFromEnv(path.join(REPO_ROOT, "media")),
  WEB_DIST_DIR: dirFromEnv(
    path.join(REPO_ROOT, "artifacts", "captures-by-capri", "dist", "public"),
  ),
  // Production serves the built SPA from Express. Locally Vite owns it so HMR works.
  SERVE_STATIC: boolFromEnv(false),

  // Scheduler. MUST stay at most once per day — see services/scheduler.ts.
  ENABLE_SCHEDULER: boolFromEnv(false),
  CRON_SCHEDULE: z.string().default("0 14 * * *"),
  CRON_TIMEZONE: z.string().default("America/Chicago"),

  // Third-party integrations. Optional in the type so local dev never needs real
  // credentials — most libs degrade to a warn-and-skip when unconfigured.
  // CALCOM_API_KEY is the exception: lib/calcom.ts throws outright rather than
  // degrading (confirm/decline/cancel all sync Cal.com's side of a booking, and
  // there's no sane no-op for that), so it's enforced below as required whenever
  // NODE_ENV=production.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Public base URL of the deployed site, no trailing slash (e.g.
  // https://capturesbycapri.com, or http://localhost:5173 locally). Stripe
  // Checkout Sessions require absolute success/cancel redirect URLs — see
  // lib/stripe.ts#createCheckoutSession. Required whenever STRIPE_SECRET_KEY
  // is set in production (enforced below); createCheckoutSession also throws
  // if it's missing at call time, same as an unconfigured Stripe key.
  SITE_URL: z.string().url().optional(),
  CALCOM_API_KEY: z.string().optional(),
  CAL_WEBHOOK_SECRET: z.string().optional(),
  // Carrier lookup for texting clients via a carrier's SMS-to-email gateway
  // (see lib/carrier-lookup.ts). Free tier at abstractapi.com. Replaces the
  // Twilio integration this project started with — see git history if you
  // need it back. The admin's own number/carrier are configured on the admin
  // settings page instead (admin_settings table), not via env var — no
  // lookup needed for a single fixed number.
  ABSTRACT_API_KEY: z.string().optional(),

  // SMTP (client email), via an existing mailbox rather than a dedicated
  // sending API. See lib/email.ts for why: the previous provider (Resend)
  // required a domain-wide MX record that broke inbound mail for every other
  // mailbox on the domain.
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  // true for port 465 (implicit TLS); false (default, port 587) negotiates
  // TLS via STARTTLS instead. Most providers, including Namecheap Private
  // Email, expect 587/STARTTLS.
  SMTP_SECURE: boolFromEnv(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  // "Display Name <address>". Defaults to SMTP_USER unadorned if unset. Most
  // SMTP providers reject a From address that isn't the authenticated
  // mailbox (or a verified alias of it), so this generally can't diverge
  // from SMTP_USER's domain.
  SMTP_FROM: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === "production" && !data.CALCOM_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["CALCOM_API_KEY"],
      message:
        "CALCOM_API_KEY is required when NODE_ENV=production. Confirming, " +
        "declining, and canceling Cal.com bookings all call it with no " +
        "fallback — get a key from Cal.com Settings -> Developer -> API keys.",
    });
  }
  if (data.NODE_ENV === "production" && data.STRIPE_SECRET_KEY && !data.SITE_URL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SITE_URL"],
      message:
        "SITE_URL is required when STRIPE_SECRET_KEY is set in production — " +
        "every deposit/final-invoice Checkout Session needs it to build a " +
        "success/cancel redirect URL.",
    });
  }
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  ${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("\n");
  // Fail loudly with every problem at once rather than one cryptic error at a time.
  throw new Error(
    `Invalid environment configuration:\n${issues}\n\n` +
      `Copy .env.example to .env and fill in the required values.`,
  );
}

export const env = parsed.data;
export type Env = typeof env;
