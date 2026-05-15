import express, { type Router } from "express";
import type { FetchFormattedGuideOpts } from "./agent.js";
import { fetchFormattedMarkdown } from "./agent.js";
import { DozukiClient } from "./client.js";

/** Factory options shared by routes (base URL, auth). */
export type DozukiRouterOptions = Pick<
  FetchFormattedGuideOpts,
  "baseUrl" | "auth" | "fetchFn"
>;

/** Express routes: GET `/:guideid/markdown`, GET `/:guideid/json` */
export function createDozukiRouter(shared: DozukiRouterOptions): Router {
  const r = express.Router();

  r.get("/:guideid/markdown", async (req, res, next) => {
    try {
      const guideid = Number(req.params.guideid);
      if (!Number.isFinite(guideid)) {
        res.status(400).type("text/plain").send("Invalid guide id");
        return;
      }
      const hydrateDocuments = req.query.hydrate === "1" || req.query.hydrate === "true";
      const md = await fetchFormattedMarkdown({
        ...shared,
        guideid,
        hydrateDocuments,
        guideQuery:
          req.query.excludePrerequisiteSteps === "1" ?
            { excludePrerequisiteSteps: true }
          : undefined,
      });
      res.type("text/markdown; charset=utf-8").send(md);
    } catch (e) {
      next(e);
    }
  });

  r.get("/:guideid/json", async (req, res, next) => {
    try {
      const guideid = Number(req.params.guideid);
      if (!Number.isFinite(guideid)) {
        res.status(400).json({ error: "Invalid guide id" });
        return;
      }
      const client = new DozukiClient(shared);
      const guide = await client.getGuide(guideid, {
        includeComments: false,
        excludePrerequisiteSteps:
          req.query.excludePrerequisiteSteps === "1" ? true : false,
      });
      res.json(guide);
    } catch (e) {
      next(e);
    }
  });

  return r;
}
