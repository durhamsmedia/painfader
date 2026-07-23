import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const app: Express = express();

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
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// ── Serve the built Painfader frontend ───────────────────────────────────────
// Explicit path via env var, or relative to WorkingDirectory set in systemd.
// On Giada: WorkingDirectory=/opt/painfader/artifacts/api-server
//           FRONTEND_DIST=/opt/painfader/artifacts/painfader/dist/public
const frontendDist =
  process.env.FRONTEND_DIST ||
  path.resolve(process.cwd(), "../painfader/dist/public");

logger.info({ frontendDist, exists: fs.existsSync(frontendDist) }, "Frontend dist path");

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("/{*path}", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
} else {
  logger.warn({ frontendDist }, "Frontend dist not found — UI will not be served");
}

export default app;
