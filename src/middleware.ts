import express, { type Request, type Router } from "express";
import type { FetchFormattedGuideOpts } from "./agent.js";
import { fetchFormattedMarkdown } from "./agent.js";
import { DozukiClient } from "./client.js";
import { resolveAuth, resolveBaseUrl } from "./resolve-auth.js";
import { buildSwpExport } from "./swp/export-build.js";
import { swpDocxFilename, type SwpDocxMeta } from "./swp/export-docx.js";
import { swpExportBasename } from "./swp/export-meta.js";
import { htmlToPdfBuffer } from "./swp/export-pdf.js";
import { compareGuides } from "./merge/compare.js";
import type { DozukiAuth } from "./types.js";

function swpMetaFromQuery(req: Request): SwpDocxMeta {
  const q = req.query;
  const str = (k: string) => {
    const v = q[k];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return {
    department: str("department"),
    documentName: str("documentName"),
    documentNumber: str("documentNumber"),
    author: str("author"),
    revision: str("revision"),
    date: str("date"),
  };
}

/** Factory options shared by routes (base URL, auth). */
export type DozukiRouterOptions = {
  baseUrl: string;
  defaultAuth?: DozukiAuth;
  fetchFn?: FetchFormattedGuideOpts["fetchFn"];
};

function clientOpts(req: Request, shared: DozukiRouterOptions) {
  return {
    baseUrl: resolveBaseUrl(req, shared.baseUrl),
    auth: resolveAuth(req, shared.defaultAuth),
    fetchFn: shared.fetchFn,
  };
}

/** Express routes: GET `/:guideid/markdown`, GET `/:guideid/json` */
export function createDozukiRouter(shared: DozukiRouterOptions): Router {
  const r = express.Router();

  r.get("/compare", async (req, res, next) => {
    try {
      const raw = req.query.guides;
      const guidesParam =
        typeof raw === "string" ? raw
        : Array.isArray(raw) ? raw.map(String).join(",")
        : "";
      const ids = guidesParam
        .split(/[,\s]+/)
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (ids.length < 2) {
        res.status(400).json({
          error: "Provide at least two guide IDs: ?guides=4,12,19",
        });
        return;
      }
      const pivotRaw = req.query.pivot;
      const pivot =
        pivotRaw != null && pivotRaw !== "" ? Number(pivotRaw) : 0;
      if (!Number.isFinite(pivot) || pivot < 0 || pivot >= ids.length) {
        res.status(400).json({ error: "Invalid pivot index" });
        return;
      }

      const client = new DozukiClient(clientOpts(req, shared));
      const guides = await Promise.all(
        ids.map((id) =>
          client.getGuide(id, {
            includeComments: false,
            excludePrerequisiteSteps:
              req.query.excludePrerequisiteSteps === "1" ? true : false,
          }),
        ),
      );
      const result = compareGuides(guides, pivot);
      res.json(result);
    } catch (e) {
      next(e);
    }
  });

  r.get("/:guideid/markdown", async (req, res, next) => {
    try {
      const guideid = Number(req.params.guideid);
      if (!Number.isFinite(guideid)) {
        res.status(400).type("text/plain").send("Invalid guide id");
        return;
      }
      const hydrateDocuments = req.query.hydrate === "1" || req.query.hydrate === "true";
      const md = await fetchFormattedMarkdown({
        ...clientOpts(req, shared),
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

  async function loadGuideForExport(req: Request, guideid: number) {
    const client = new DozukiClient(clientOpts(req, shared));
    return client.getGuide(guideid, {
      includeComments: false,
      excludePrerequisiteSteps:
        req.query.excludePrerequisiteSteps === "1" ? true : false,
    });
  }

  r.get("/:guideid/html", async (req, res, next) => {
    try {
      const guideid = Number(req.params.guideid);
      if (!Number.isFinite(guideid)) {
        res.status(400).type("text/plain").send("Invalid guide id");
        return;
      }
      const opts = clientOpts(req, shared);
      const guide = await loadGuideForExport(req, guideid);
      const { html } = await buildSwpExport(guide, opts, swpMetaFromQuery(req));
      const inline = req.query.inline === "1" || req.query.inline === "true";
      const filename = `${swpExportBasename(guide)}.html`;
      res.status(200).type("text/html; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `${inline ? "inline" : "attachment"}; filename="${filename}"`,
      );
      res.send(html);
    } catch (e) {
      next(e);
    }
  });

  r.get("/:guideid/pdf", async (req, res, next) => {
    try {
      const guideid = Number(req.params.guideid);
      if (!Number.isFinite(guideid)) {
        res.status(400).type("text/plain").send("Invalid guide id");
        return;
      }
      const opts = clientOpts(req, shared);
      const guide = await loadGuideForExport(req, guideid);
      const { html } = await buildSwpExport(guide, opts, swpMetaFromQuery(req));
      const pdf = await htmlToPdfBuffer(html);
      const filename = `${swpExportBasename(guide)}.pdf`;
      res
        .status(200)
        .type("application/pdf")
        .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
        .send(pdf);
    } catch (e) {
      next(e);
    }
  });

  r.get("/:guideid/docx", async (req, res, next) => {
    try {
      const guideid = Number(req.params.guideid);
      if (!Number.isFinite(guideid)) {
        res.status(400).json({ error: "Invalid guide id" });
        return;
      }
      const opts = clientOpts(req, shared);
      const guide = await loadGuideForExport(req, guideid);
      const { docx: buf } = await buildSwpExport(guide, opts, swpMetaFromQuery(req));
      const filename = swpDocxFilename(guide);
      res
        .status(200)
        .type("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        .setHeader("Content-Disposition", `attachment; filename="${filename}"`)
        .send(buf);
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
      const client = new DozukiClient(clientOpts(req, shared));
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
