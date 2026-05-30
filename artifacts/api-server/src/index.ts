import app from "./app";
import { logger } from "./lib/logger";

const port = parseInt(process.env.PORT ?? "3000", 10);

app.listen(port, () => {
  logger.info({ port }, "API server listening");
});
