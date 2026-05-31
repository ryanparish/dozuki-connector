import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import JSZip from "jszip";
import type { HydratedGuide } from "../types.js";
import { guideToSwpContent } from "./guide-to-swp.js";
import {
  cloneElement,
  collectText,
  escapeXmlText,
  findSectionHeadingRow,
  findTableWithHeading,
  getDirectTableRows,
  parseXml,
  removeRowsAfterHeading,
  removeRowsBetween,
  serializeXml,
  setRowCalloutText,
  setRowInstructionText,
  type XmlDocument,
  type XmlElement,
} from "./ooxml-utils.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATE_PATH = path.join(__dirname, "../../templates/swp-reference.docx");
const FRAGMENTS_DIR = path.join(__dirname, "../../templates/fragments");

import type { FetchedImages } from "./embed-images.js";
import { addImageToDocx, rowAccentCell, setCellImage } from "./docx-images.js";
import type { SwpExportMeta } from "./export-meta.js";
import { resolveSwpMeta, swpExportBasename } from "./export-meta.js";

export type SwpDocxMeta = SwpExportMeta;

function loadFragment(name: string): XmlElement {
  const xml = fs.readFileSync(path.join(FRAGMENTS_DIR, name), "utf8");
  const el = parseXml(xml).documentElement;
  if (!el) throw new Error(`Invalid fragment: ${name}`);
  return el;
}

function applyHeaderReplacements(headerXml: string, guide: HydratedGuide, meta: SwpDocxMeta): string {
  const m = resolveSwpMeta(guide, meta);

  const pairs: [string, string][] = [
    ["Band Saw Body", escapeXmlText(m.documentName)],
    ["Chris A Talley", escapeXmlText(m.author)],
    ["Rough Mill Body", escapeXmlText(m.department)],
    ["SWP-RMB-Band Saw Body", escapeXmlText(m.documentNumber)],
    ["1/23/2025", escapeXmlText(m.date)],
    ["Revision:", "Revision:"],
    ["1.0", escapeXmlText(m.revision)],
  ];

  let out = headerXml;
  for (const [from, to] of pairs) {
    out = out.split(from).join(to);
  }
  return out;
}

async function fillOverviewTable(
  tbl: XmlElement,
  overviewLines: string[],
  overviewImageUrl: string | undefined,
  doc: XmlDocument,
  zip: JSZip,
  images?: FetchedImages,
): Promise<void> {
  const overviewHead = findSectionHeadingRow(tbl, "Overview");
  const setupHead = findSectionHeadingRow(tbl, "Set-up");
  if (!overviewHead || !setupHead) {
    throw new Error("Template Overview table missing Overview or Set-up heading rows");
  }

  removeRowsBetween(tbl, overviewHead, setupHead);
  removeRowsAfterHeading(tbl, setupHead);

  const overviewProto = cloneElement(doc, loadFragment("overview-row.xml"));

  for (let i = overviewLines.length - 1; i >= 0; i--) {
    const row = cloneElement(doc, overviewProto);
    setRowInstructionText(row, overviewLines[i]!, false);
    const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    const cells = row.getElementsByTagNameNS(W, "tc");
    if (cells.length >= 3) {
      const col3 = cells.item(2)!;
      while (col3.firstChild) col3.removeChild(col3.firstChild);
      col3.appendChild(doc.createElementNS(W, "w:p"));
    }
    const imgUrl = i === 0 ? overviewImageUrl : undefined;
    if (imgUrl && images?.bytes.has(imgUrl)) {
      const cell = rowAccentCell(row);
      if (cell) {
        const rId = await addImageToDocx(zip, images.bytes.get(imgUrl)!, images.mime.get(imgUrl)!);
        setCellImage(cell, rId, doc);
      }
    }
    tbl.insertBefore(row, setupHead);
  }
}

async function fillProcessTable(
  tbl: XmlElement,
  processRows: ReturnType<typeof guideToSwpContent>["processRows"],
  doc: XmlDocument,
  zip: JSZip,
  images?: FetchedImages,
): Promise<void> {
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const processHead = findSectionHeadingRow(tbl, "Process");
  if (!processHead) throw new Error("Template Process table missing Process heading row");

  removeRowsAfterHeading(tbl, processHead);

  const instrProto = loadFragment("process-row-8.xml");

  for (const pr of processRows) {
    const label =
      pr.stepNumber != null ? `${pr.stepNumber}. ${pr.text}` : pr.text;
    const row = cloneElement(doc, instrProto);
    setRowInstructionText(row, label, pr.stepNumber != null);
    if (pr.callouts.length > 0) {
      setRowCalloutText(row, pr.callouts.join(" "));
    } else {
      const cells = row.getElementsByTagNameNS(W, "tc");
      const col3 = cells.item(cells.length - 1);
      if (col3) {
        while (col3.firstChild) col3.removeChild(col3.firstChild);
        col3.appendChild(doc.createElementNS(W, "w:p"));
      }
    }
    if (pr.imageUrl && images?.bytes.has(pr.imageUrl)) {
      const cell = rowAccentCell(row);
      if (cell) {
        const rId = await addImageToDocx(
          zip,
          images.bytes.get(pr.imageUrl)!,
          images.mime.get(pr.imageUrl)!,
        );
        setCellImage(cell, rId, doc);
      }
    }
    tbl.appendChild(row);
  }

  const completeProto = cloneElement(doc, instrProto);
  setRowInstructionText(completeProto, "Step Complete", false);
  tbl.appendChild(completeProto);
}

/** Remove single-row tables with no section heading (Band Saw overflow rows split out of main table). */
function removeOrphanProcedureTables(body: XmlElement): void {
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const toRemove: XmlElement[] = [];
  for (let node = body.firstChild; node; node = node.nextSibling) {
    if (node.nodeType !== 1 || (node as XmlElement).localName !== "tbl") continue;
    const tbl = node as XmlElement;
    const rows = getDirectTableRows(tbl);
    if (rows.length !== 1) continue;
    if (findSectionHeadingRow(tbl, "Overview") || findSectionHeadingRow(tbl, "Process")) {
      continue;
    }
    const text = collectText(tbl);
    if (text.length > 20) toRemove.push(tbl);
  }
  for (const tbl of toRemove) tbl.parentNode?.removeChild(tbl);
}

/** Drop empty Set-up heading left after we clear setup steps. */
function removeEmptySetupHeading(tbl: XmlElement): void {
  const setupHead = findSectionHeadingRow(tbl, "Set-up");
  if (!setupHead) return;
  const rows = getDirectTableRows(tbl);
  const idx = rows.indexOf(setupHead);
  if (idx < 0 || idx !== rows.length - 1) return;
  const text = collectText(setupHead).trim();
  if (text === "Set-up") setupHead.parentNode?.removeChild(setupHead);
}

async function patchDocumentInZip(
  zip: JSZip,
  docXml: string,
  guide: HydratedGuide,
  images?: FetchedImages,
): Promise<string> {
  const content = guideToSwpContent(guide);
  const doc = parseXml(docXml);
  const body = doc.getElementsByTagNameNS(
    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
    "body",
  ).item(0);
  if (!body) throw new Error("Invalid template: missing w:body");

  removeOrphanProcedureTables(body);

  const overviewTbl = findTableWithHeading(body, "Overview");
  const processTbl = findTableWithHeading(body, "Process");
  if (!overviewTbl) throw new Error("Template missing Overview table");
  if (!processTbl) throw new Error("Template missing Process table");

  await fillOverviewTable(
    overviewTbl,
    content.overviewLines,
    content.overviewImageUrl,
    doc,
    zip,
    images,
  );
  removeEmptySetupHeading(overviewTbl);
  await fillProcessTable(processTbl, content.processRows, doc, zip, images);

  if (content.conclusion) {
    const instrProto = loadFragment("process-row-8.xml");
    const noteRow = cloneElement(doc, instrProto);
    setRowInstructionText(noteRow, content.conclusion, false);
    processTbl.appendChild(noteRow);
  }

  return serializeXml(doc);
}

/** Build an SWP .docx from the reference template + Dozuki guide content. */
export async function exportGuideToSwpDocx(
  guide: HydratedGuide,
  meta: SwpDocxMeta = {},
  images?: FetchedImages,
): Promise<Buffer> {
  if (!fs.existsSync(TEMPLATE_PATH)) {
    throw new Error(`SWP template not found: ${TEMPLATE_PATH}`);
  }

  const templateBuf = fs.readFileSync(TEMPLATE_PATH);
  const zip = await JSZip.loadAsync(templateBuf);

  const docFile = zip.file("word/document.xml");
  const headerFile = zip.file("word/header1.xml");
  if (!docFile || !headerFile) throw new Error("Invalid SWP template package");

  const docXml = await docFile.async("string");
  const headerXml = await headerFile.async("string");

  zip.file("word/document.xml", await patchDocumentInZip(zip, docXml, guide, images));
  zip.file("word/header1.xml", applyHeaderReplacements(headerXml, guide, meta));

  const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return Buffer.from(out);
}

export function swpDocxFilename(guide: HydratedGuide): string {
  return `${swpExportBasename(guide)}.docx`;
}
