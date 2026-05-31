/** @deprecated Use template pipeline: exportGuideToSwpDocx → docxToReadOnlyHtml */
import type { HydratedGuide } from "../types.js";
import type { EmbeddedImages } from "./embed-images.js";
import { imgSrc } from "./embed-images.js";
import { resolveSwpMeta, type SwpExportMeta } from "./export-meta.js";
import { guideToSwpContent } from "./guide-to-swp.js";
import type { SwpProcessRow } from "./process-rows.js";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function calloutClass(text: string): string {
  if (text.startsWith("Warning!")) return "callout warning";
  if (text.startsWith("Caution!")) return "callout caution";
  if (text.startsWith("Note:")) return "callout note";
  if (text.startsWith("Quality")) return "callout quality";
  return "callout";
}

function renderPhoto(url: string | undefined, embedded: EmbeddedImages, baseUrl: string): string {
  if (!url) return "";
  return `<figure class="photo"><img src="${esc(imgSrc(url, embedded, baseUrl))}" alt="" /></figure>`;
}

function renderProcessRow(
  row: SwpProcessRow,
  embedded: EmbeddedImages,
  baseUrl: string,
): string {
  const stepLabel =
    row.stepNumber != null ? `<span class="step-num">${row.stepNumber}.</span> ` : "";
  const calloutHtml = row.callouts
    .map((c) => `<p class="${calloutClass(c)}">${esc(c)}</p>`)
    .join("");
  const instructionHtml =
    row.text ?
      `<p class="instruction">${stepLabel}${esc(row.text)}</p>`
    : "";
  return `<tr class="row-step">
    <td class="col-accent">${renderPhoto(row.imageUrl, embedded, baseUrl)}</td>
    <td class="col-instruction">${instructionHtml}</td>
    <td class="col-callout">${calloutHtml}</td>
  </tr>`;
}

const SWP_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: Calibri, "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.4;
    color: #1a1a1a;
    background: #e8e8e8;
  }
  .readonly-banner {
    background: #1e3a5f;
    color: #fff;
    padding: 0.6rem 1rem;
    font-size: 0.85rem;
    text-align: center;
  }
  .document {
    max-width: 10in;
    margin: 0.75rem auto 1.5rem;
    background: #fff;
    padding: 0.6in 0.55in;
    box-shadow: 0 1px 8px rgba(0,0,0,.15);
  }
  .meta-grid {
    display: grid;
    grid-template-columns: 130px 1fr 130px 1fr;
    gap: 0.2rem 0.75rem;
    font-size: 10pt;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid #86764e;
  }
  .meta-grid dt { font-weight: 700; color: #444; margin: 0; }
  .meta-grid dd { margin: 0; }
  h1.doc-title {
    font-size: 16pt;
    font-weight: 700;
    color: #86764e;
    margin: 0 0 0.75rem;
  }
  h2.section {
    font-size: 13pt;
    font-weight: 700;
    color: #86764e;
    margin: 1.25rem 0 0.5rem;
    padding-bottom: 0.15rem;
    border-bottom: 1px solid #bbb;
  }
  .overview-block {
    display: grid;
    grid-template-columns: 1fr 2.2fr;
    gap: 0.75rem;
    align-items: start;
    margin-bottom: 0.5rem;
  }
  .overview-block.no-image { grid-template-columns: 1fr; }
  .overview-block img {
    max-width: 100%;
    height: auto;
    border: 1px solid #ccc;
  }
  .overview-list { margin: 0; padding-left: 1.1rem; }
  .overview-list li { margin-bottom: 0.25rem; }
  table.swp-grid {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.swp-grid td {
    vertical-align: top;
    padding: 0.4rem 0.5rem;
    border: 1px solid #c5c5c5;
  }
  .col-accent {
    width: 24%;
    background: #f3efe9;
  }
  .col-instruction { width: 38%; }
  .col-callout {
    width: 38%;
    background: #fafafa;
  }
  .col-accent .photo { margin: 0; }
  .col-accent img {
    display: block;
    max-width: 100%;
    max-height: 3.5in;
    width: auto;
    height: auto;
    object-fit: contain;
  }
  .instruction { margin: 0; }
  .step-num { font-weight: 700; color: #86764e; }
  .callout { margin: 0; line-height: 1.35; }
  .callout.warning { color: #c00; font-weight: 700; }
  .callout.caution { color: #d35400; font-weight: 700; }
  .callout.note { color: #333; }
  .row-step:has(.col-callout p) .col-callout {
    border-left: 3px solid #e8d4c4;
  }
  .appendix-note {
    margin-top: 1.5rem;
    padding: 0.6rem 0.75rem;
    background: #f4f4f4;
    border-left: 4px solid #86764e;
    font-size: 9.5pt;
    color: #555;
  }
  .footer {
    margin-top: 1.25rem;
    font-size: 8.5pt;
    color: #666;
    text-align: center;
  }
  @media print {
    body { background: #fff; }
    .document { box-shadow: none; margin: 0; max-width: none; }
  }
`;

export interface RenderSwpHtmlOpts {
  guide: HydratedGuide;
  meta?: SwpExportMeta;
  embedded: EmbeddedImages;
  baseUrl: string;
}

/** Standalone read-only SWP HTML (images embedded when provided in `embedded`). */
export function renderSwpHtml(opts: RenderSwpHtmlOpts): string {
  const { guide, embedded, baseUrl } = opts;
  const m = resolveSwpMeta(guide, opts.meta);
  const content = guideToSwpContent(guide);
  const exportedAt = new Date().toISOString();
  const guideId = guide.guideid ?? "?";
  const sourceUrl = guide.url ? esc(guide.url) : "";

  const overviewPhoto = renderPhoto(content.overviewImageUrl, embedded, baseUrl);
  const overviewClass = overviewPhoto ? "overview-block" : "overview-block no-image";
  const overviewList = content.overviewLines.map((l) => `<li>${esc(l)}</li>`).join("");

  const processRows = content.processRows
    .map((r) => renderProcessRow(r, embedded, baseUrl))
    .join("\n");

  const conclusionBlock =
    content.conclusion ?
      `<h2 class="section">Conclusion</h2><p>${esc(content.conclusion)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${esc(m.documentName)} — SWP Export</title>
  <style>${SWP_CSS}</style>
</head>
<body contenteditable="false">
  <div class="readonly-banner" role="note">
    <strong>Read-only export from Dozuki.</strong>
    Edit this procedure in Dozuki only; do not treat this file as a controlled source document.
  </div>
  <article class="document">
    <h1 class="doc-title">${esc(m.documentName)}</h1>
    <dl class="meta-grid">
      <dt>Document number</dt><dd>${esc(m.documentNumber)}</dd>
      <dt>Department</dt><dd>${esc(m.department) || "—"}</dd>
      <dt>Author</dt><dd>${esc(m.author) || "—"}</dd>
      <dt>Revision</dt><dd>${esc(m.revision)}</dd>
      <dt>Date</dt><dd>${esc(m.date)}</dd>
      <dt>Guide ID</dt><dd>${esc(String(guideId))}</dd>
    </dl>

    <h2 class="section">Overview</h2>
    <div class="${overviewClass}">
      ${overviewPhoto ? `<div class="overview-media">${overviewPhoto}</div>` : ""}
      <ul class="overview-list">${overviewList}</ul>
    </div>

    <h2 class="section">Process</h2>
    <table class="swp-grid">
      <tbody>
        ${processRows}
      </tbody>
    </table>

    ${conclusionBlock}

    <p class="appendix-note">
      Icon glossary, Gibson glossary, 5S workstation, revision history, and approval tables
      are maintained in the master SWP Word template and are not regenerated from Dozuki.
    </p>

    <p class="footer">
      Exported ${esc(exportedAt)} · Guide ${esc(String(guideId))}
      ${sourceUrl ? ` · <a href="${sourceUrl}">Source in Dozuki</a>` : ""}
    </p>
  </article>
</body>
</html>`;
}
