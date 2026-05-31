import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createDozukiRouter } from "./middleware.js";
import { loadLocalEnv } from "./load-env.js";

loadLocalEnv();
const port = Number(process.env.PORT || "3847");
const baseUrl =
  process.env.DOZUKI_BASE_URL || "https://gp-sandbox.dozuki.com";

const defaultAuth =
  process.env.DOZUKI_API_KEY ?
    {
      kind: "api-header" as const,
      apiKey: process.env.DOZUKI_API_KEY,
      appId: process.env.DOZUKI_APP_ID,
    }
  : undefined;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "..", "public");

const app = express();
app.use(express.json());
app.use(express.static(publicDir));
app.use("/dozuki", createDozukiRouter({ baseUrl, defaultAuth }));

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(msg);
    res.status(502).type("text/plain").send(msg);
  },
);

app.listen(port, () => {
  console.error(`UI:      http://localhost:${port}/`);
  console.error(`Merge:   http://localhost:${port}/merge.html`);
  console.error(
    `API:     http://localhost:${port}/dozuki/{guideid}/markdown  (DOZUKI_BASE_URL=${baseUrl})`,
  );
});
