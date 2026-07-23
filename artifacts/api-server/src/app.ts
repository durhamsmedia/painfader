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
  // SPA fallback — serve index.html for any unmatched route
  const indexHtml = path.join(frontendDist, "index.html");
  app.use((_req, res) => {
    res.type("html").send(fs.readFileSync(indexHtml));
  });
} else {
  logger.warn({ frontendDist }, "Frontend dist not found — UI will not be served");
}

// ── Debug: show what the running server sees ─────────────────────────────────
app.get("/_debug", (_req, res) => {
  const indexPath = path.join(frontendDist, "index.html");
  res.json({
    frontendDist,
    dirExists: fs.existsSync(frontendDist),
    indexExists: fs.existsSync(indexPath),
    cwd: process.cwd(),
    env_FRONTEND_DIST: process.env.FRONTEND_DIST,
  });
});

// ── Error handler — logs actual error instead of generic HTML page ────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ errMsg: err?.message, errCode: err?.code, stack: err?.stack }, "Express error handler");
  res.status(500).json({ error: err?.message ?? "unknown", code: err?.code });
});

export default app;
