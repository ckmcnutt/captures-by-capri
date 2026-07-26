// MUST be first: db/client.ts reads env.DATABASE_URL at module scope, so the
// environment has to be loaded and validated before anything else is imported.
import "./env";

import { env } from "./env";
import app from "./app";
import { assertDbReachable, closeDb } from "./db/client";
import { logger } from "./lib/logger";
import { startScheduler, stopScheduler } from "./services/scheduler";

async function main(): Promise<void> {
  // Fail fast with a clear message rather than 500ing on the first request.
  await assertDbReachable();
  logger.info("Database connection established");

  const server = app.listen(env.PORT, () => {
    logger.info(
      {
        port: env.PORT,
        env: env.NODE_ENV,
        serveStatic: env.SERVE_STATIC,
        scheduler: env.ENABLE_SCHEDULER,
      },
      "API server listening",
    );
  });

  if (env.ENABLE_SCHEDULER) {
    startScheduler();
  } else {
    logger.info("Scheduler disabled (ENABLE_SCHEDULER=false)");
  }

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");

    server.close(() => {
      void (async () => {
        try {
          await stopScheduler();
          await closeDb();
        } catch (err) {
          logger.error({ err }, "Error during shutdown");
        } finally {
          process.exit(0);
        }
      })();
    });

    // Don't hang forever on a stuck connection.
    setTimeout(() => {
      logger.warn("Forcing exit after shutdown timeout");
      process.exit(1);
    }, 10_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.fatal({ err }, "Failed to start API server");
  process.exit(1);
});
