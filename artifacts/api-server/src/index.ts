// MUST be first: validates the environment before anything else reads it.
import "./env";

import { env } from "./env";
import app from "./app";
import { logger } from "./lib/logger";

const server = app.listen(env.PORT, () => {
  logger.info(
    { port: env.PORT, env: env.NODE_ENV, serveStatic: env.SERVE_STATIC },
    "API server listening",
  );
});

const shutdown = (signal: string): void => {
  logger.info({ signal }, "Shutting down");
  server.close(() => process.exit(0));
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10_000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
