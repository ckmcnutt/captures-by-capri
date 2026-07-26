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

  // Third-party integrations. All optional: each lib degrades to a warn-and-skip
  // when unconfigured, which is what makes local testing safe.
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  CALCOM_API_KEY: z.string().optional(),
  CAL_WEBHOOK_SECRET: z.string().optional(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),
  ADMIN_PHONE_NUMBER: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
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
