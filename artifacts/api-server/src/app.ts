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
const frontendDist =
  process.env.FRONTEND_DIST ||
  path.resolve(process.cwd(), "../painfader/dist/public");

const indexHtml = path.join(frontendDist, "index.html");
const dirExists = fs.existsSync(frontendDist);
const indexExists = fs.existsSync(indexHtml);

logger.info({ frontendDist, dirExists, indexExists }, "Frontend dist path");

if (dirExists) {
  // Serve static assets at both root and /painfader/ prefix
  // (Vite builds with BASE_PATH=/painfader for Replit proxy routing)
  app.use(express.static(frontendDist));
  app.use("/painfader", express.static(frontendDist));
  // SPA fallback — serve index.html for any unmatched route
  app.use((_req, res) => {
    res.type("html").send(fs.readFileSync(indexHtml));
  });
} else {
  logger.warn({ frontendDist }, "Frontend dist not found — UI will not be served");
}

export default app;
