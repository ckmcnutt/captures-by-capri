import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "../env";
import { logger } from "../lib/logger";
import * as relations from "./relations";
import * as schema from "./schema";

/**
 * Replaces the old service-role Supabase client. Plain node-postgres against a
 * loopback Postgres on the app host, so no TLS configuration is needed.
 */
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  // Bounded so a runaway loop can't exhaust Postgres' default 100 connections.
  // Generous for a single-admin app.
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: "capri-api",
});

// Without this an idle-client error becomes an unhandled 'error' event and takes
// the process down.
pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle Postgres client");
});

export const db = drizzle(pool, {
  schema: { ...schema, ...relations },
  logger: env.LOG_LEVEL === "debug",
});

export type Db = typeof db;

/** Verify connectivity at boot so a bad DATABASE_URL fails fast and clearly. */
export async function assertDbReachable(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("select 1");
  } finally {
    client.release();
  }
}

export async function closeDb(): Promise<void> {
  await pool.end();
}
