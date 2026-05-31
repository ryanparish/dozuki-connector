import fs from "node:fs";
import path from "node:path";
import { DozukiClient } from "./client.js";
import { loadLocalEnv } from "./load-env.js";
import { buildSwpExport } from "./swp/export-build.js";
import { swpDocxFilename } from "./swp/export-docx.js";

loadLocalEnv();

const baseUrl = process.env.DOZUKI_BASE_URL || "https://gp-sandbox.dozuki.com";
const guideid = Number(process.env.DOZUKI_GUIDE_ID || "4");
const apiKey = process.env.DOZUKI_API_KEY;

if (!apiKey) {
  console.error("Set DOZUKI_API_KEY in .env to run export-docx demo.");
  process.exit(1);
}

const clientOpts = {
  baseUrl,
  auth: { kind: "api-header" as const, apiKey, appId: process.env.DOZUKI_APP_ID },
};

const client = new DozukiClient(clientOpts);
const guide = await client.getGuide(guideid, { includeComments: false });
const { docx } = await buildSwpExport(guide, clientOpts, {
  documentName: guide.title,
  department: guide.category,
});
const out = path.join(process.cwd(), swpDocxFilename(guide));
fs.writeFileSync(out, docx);
console.error(`Wrote ${out}`);
