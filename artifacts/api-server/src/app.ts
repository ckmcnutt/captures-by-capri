import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import router from "./routes/index";

const app = express();

const isProduction = process.env.NODE_ENV === "production";

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
        return {
          statusCode: res.statusCode,
        };
      },
    },
  })
);

app.use("/api/webhooks/stripe", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/api", router);

export default app;
