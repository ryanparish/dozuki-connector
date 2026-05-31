import type { DozukiClientOptions } from "../types.js";
import type { HydratedGuide } from "../types.js";
import { collectGuideImageUrls } from "./step-images.js";
import { embedImageUrls } from "./embed-images.js";
import { exportGuideToSwpDocx } from "./export-docx.js";
import { docxToReadOnlyHtml } from "./docx-to-html.js";
import { resolveSwpMeta, type SwpExportMeta } from "./export-meta.js";

export interface SwpBuiltExport {
  /** Read-only HTML rendered from the filled Word template */
  html: string;
  /** Filled Gibson SWP .docx (source of truth for layout/branding) */
  docx: Buffer;
  guide: HydratedGuide;
}

/**
 * Build branded export: Dozuki → fill `templates/swp-reference.docx` → HTML/PDF.
 * Layout and static sections (glossary, appendices) come from the Word template.
 */
export async function buildSwpExport(
  guide: HydratedGuide,
  clientOpts: DozukiClientOptions,
  meta?: SwpExportMeta,
): Promise<SwpBuiltExport> {
  const urls = collectGuideImageUrls(guide);
  const images = await embedImageUrls(urls, {
    baseUrl: clientOpts.baseUrl,
    auth: clientOpts.auth,
    fetchFn: clientOpts.fetchFn,
  });

  const docx = await exportGuideToSwpDocx(guide, meta, images);
  const m = resolveSwpMeta(guide, meta);
  const html = await docxToReadOnlyHtml(docx, { title: m.documentName });

  return { html, docx, guide };
}
