import fs from "node:fs";
import path from "node:path";
import { DozukiClient } from "./client.js";
import { loadLocalEnv } from "./load-env.js";
import { buildSwpExport } from "./swp/export-build.js";
import { swpExportBasename } from "./swp/export-meta.js";
import { htmlToPdfBuffer } from "./swp/export-pdf.js";

loadLocalEnv();

const baseUrl = process.env.DOZUKI_BASE_URL || "https://gp-sandbox.dozuki.com";
const guideid = Number(process.env.DOZUKI_GUIDE_ID || "4");
const apiKey = process.env.DOZUKI_API_KEY;

if (!apiKey) {
  console.error("Set DOZUKI_API_KEY in .env to run export-pdf demo.");
  process.exit(1);
}

const clientOpts = {
  baseUrl,
  auth: { kind: "api-header" as const, apiKey, appId: process.env.DOZUKI_APP_ID },
};

const client = new DozukiClient(clientOpts);
const guide = await client.getGuide(guideid, { includeComments: false });
const { html } = await buildSwpExport(guide, clientOpts, { documentName: guide.title });
const pdf = await htmlToPdfBuffer(html);
const out = path.join(process.cwd(), `${swpExportBasename(guide)}.pdf`);
fs.writeFileSync(out, pdf);
console.error(`Wrote ${out}`);
