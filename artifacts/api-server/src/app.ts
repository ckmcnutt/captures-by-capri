import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import pinoHttp from "pino-http";
import { env } from "./env";
import { logger } from "./lib/logger";
import router from "./routes/index";

const app = express();

const isProduction = env.NODE_ENV === "production";

// Behind Caddy in production, so req.ip and `secure` cookies resolve correctly.
if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

// ── 1. Raw bodies for signature-verified webhooks ───────────────────────────
// MUST precede express.json(). If the body arrives already parsed, both HMAC
// checks fail with a misleading "invalid signature".
app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use("/api/webhooks/cal", express.raw({ type: "application/json" }));

// ── 2. Ordinary parsers ─────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
// The secret signs the admin session cookie; without it the cookie is forgeable.
app.use(cookieParser(env.SESSION_SECRET));

// ── 3. API — before any static handling, so no asset path can shadow a route ─
app.use("/api", router);

// ── 4. JSON 404 for unmatched API routes ────────────────────────────────────
// MUST come before the SPA fallback below. Registered after it, this is
// unreachable and /api/typo answers 200 with index.html, which turns every
// client-side API bug into a confusing JSON parse error.
app.use("/api", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── 5. Media: the local mirror of the ex-Supabase Photos bucket ──────────────
app.use(
  "/media",
  express.static(env.MEDIA_DIR, {
    index: false,
    dotfiles: "ignore",
    redirect: false,
    maxAge: isProduction ? "30d" : 0,
  }),
);

// ── 6. Terminal 404 for /media ──────────────────────────────────────────────
// Also must precede the SPA fallback. express.static calls next() when a file is
// missing, so without this a missing photo returns index.html with a 200 — the
// browser then renders the whole HTML document inside an <img> tag and shows a
// blank tile with no clue why.
app.use("/media", (_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ── 7. The built SPA (production only; locally Vite owns this and proxies here)
if (env.SERVE_STATIC) {
  app.use(express.static(env.WEB_DIST_DIR, { index: false, maxAge: "1h" }));

  // Terminal middleware, NOT app.get("*"): under Express 5's path-to-regexp v8 a
  // bare "*" throws TypeError: Missing parameter name. Every SPA-fallback snippet
  // written for Express 4 hits this.
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(path.join(env.WEB_DIST_DIR, "index.html"));
  });
}

// ── 8. Global error handler ─────────────────────────────────────────────────
// Express 5 forwards rejected promises from async handlers here.
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    req.log.error({ err }, "Unhandled error");
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  },
);

export default app;
