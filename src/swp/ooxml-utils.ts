import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Document as XmlDocument, Element as XmlElement, Node as XmlNode } from "@xmldom/xmldom";

export type { XmlDocument, XmlElement, XmlNode };

export const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

export function parseXml(xml: string): XmlDocument {
  return new DOMParser().parseFromString(xml, "application/xml");
}

export function serializeXml(doc: XmlDocument | XmlNode): string {
  return new XMLSerializer().serializeToString(doc as XmlNode);
}

export function wTag(local: string): string {
  return `${W_NS}:${local}`;
}

export function escapeXmlText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** All `w:t` text in an element, in document order. */
export function collectText(el: XmlElement): string {
  const parts: string[] = [];
  const nodes = el.getElementsByTagNameNS(W_NS, "t");
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes.item(i);
    if (n?.textContent) parts.push(n.textContent);
  }
  return parts.join("");
}

/** Replace paragraph content with a single run/text (keeps `w:pPr`). */
export function setParagraphText(p: XmlElement, text: string): void {
  const children = [...p.childNodes];
  for (const c of children) {
    if (c.nodeType === 1 && (c as XmlElement).localName !== "pPr") p.removeChild(c);
  }
  const doc = p.ownerDocument!;
  const r = doc.createElementNS(W_NS, "w:r");
  const t = doc.createElementNS(W_NS, "w:t");
  if (/^\s|\s$/.test(text)) t.setAttributeNS("http://www.w3.org/XML/1998/namespace", "xml:space", "preserve");
  t.textContent = text;
  r.appendChild(t);
  p.appendChild(r);
}

export function clearDrawings(cell: XmlElement): void {
  const drawings = cell.getElementsByTagNameNS(W_NS, "drawing");
  while (drawings.length > 0) {
    const d = drawings.item(0);
    d?.parentNode?.removeChild(d);
  }
}

function instructionCell(row: XmlElement): XmlElement | null {
  const cells = row.getElementsByTagNameNS(W_NS, "tc");
  return cells.length >= 3 ? cells.item(1)! : cells.item(cells.length - 1) ?? null;
}

/** Replace all instruction-cell paragraphs with a single styled paragraph (Dozuki text). */
export function setRowInstructionText(row: XmlElement, text: string, useNumbered: boolean): void {
  const cell = instructionCell(row);
  if (!cell) return;

  const styleName = useNumbered ? "NumberedList-Top" : "ListParagraph";
  const existing = cell.getElementsByTagNameNS(W_NS, "p");
  let protoPPr: XmlElement | null = null;
  for (let i = 0; i < existing.length; i++) {
    const p = existing.item(i)!;
    const ps = p.getElementsByTagNameNS(W_NS, "pStyle").item(0);
    if (ps?.getAttributeNS(W_NS, "val") === styleName) {
      protoPPr = p.getElementsByTagNameNS(W_NS, "pPr").item(0) ?? null;
      break;
    }
  }

  while (cell.firstChild) cell.removeChild(cell.firstChild);

  const doc = cell.ownerDocument!;
  const p = doc.createElementNS(W_NS, "w:p");
  const pPr = doc.createElementNS(W_NS, "w:pPr");
  const pStyle = doc.createElementNS(W_NS, "w:pStyle");
  pStyle.setAttributeNS(W_NS, "val", styleName);
  pPr.appendChild(pStyle);
  if (useNumbered) {
    const numPr = doc.createElementNS(W_NS, "w:numPr");
    const ilvl = doc.createElementNS(W_NS, "w:ilvl");
    ilvl.setAttributeNS(W_NS, "val", "0");
    const numId = doc.createElementNS(W_NS, "w:numId");
    numId.setAttributeNS(W_NS, "val", useNumbered ? "24" : "1");
    numPr.appendChild(ilvl);
    numPr.appendChild(numId);
    pPr.appendChild(numPr);
  } else if (protoPPr) {
    const numPr = protoPPr.getElementsByTagNameNS(W_NS, "numPr").item(0);
    if (numPr) pPr.appendChild(numPr.cloneNode(true));
  }
  p.appendChild(pPr);
  cell.appendChild(p);
  setParagraphText(p, text);
}

export function setRowCalloutText(row: XmlElement, text: string): void {
  const cells = row.getElementsByTagNameNS(W_NS, "tc");
  const cell = cells.item(cells.length - 1);
  if (!cell) return;
  clearDrawings(cell);
  while (cell.firstChild) cell.removeChild(cell.firstChild);
  const p = cell.ownerDocument!.createElementNS(W_NS, "w:p");
  cell.appendChild(p);
  setParagraphText(p, text);
}

function ensurePPr(p: XmlElement): XmlElement {
  const doc = p.ownerDocument!;
  let pPr = p.getElementsByTagNameNS(W_NS, "pPr").item(0);
  if (!pPr) {
    pPr = doc.createElementNS(W_NS, "w:pPr");
    p.insertBefore(pPr, p.firstChild);
  }
  return pPr;
}

export function cloneElement(doc: XmlDocument, el: XmlElement): XmlElement {
  const root = parseXml(serializeXml(el)).documentElement;
  if (!root) throw new Error("Failed to clone XML fragment");
  return root;
}

export function findTableWithHeading(body: XmlElement, heading: string): XmlElement | null {
  const tables = body.getElementsByTagNameNS(W_NS, "tbl");
  for (let ti = 0; ti < tables.length; ti++) {
    const tbl = tables.item(ti)!;
    if (findSectionHeadingRow(tbl, heading)) return tbl;
  }
  return null;
}

/** Find a table row whose Heading1 paragraph equals `heading` (Overview, Set-up, Process). */
export function findSectionHeadingRow(tbl: XmlElement, heading: string): XmlElement | null {
  const rows = tbl.getElementsByTagNameNS(W_NS, "tr");
  for (let i = 0; i < rows.length; i++) {
    const row = rows.item(i)!;
    const paras = row.getElementsByTagNameNS(W_NS, "p");
    for (let j = 0; j < paras.length; j++) {
      const p = paras.item(j)!;
      const style = p.getElementsByTagNameNS(W_NS, "pStyle").item(0);
      if (style?.getAttributeNS(W_NS, "val") !== "Heading1") continue;
      const text = collectText(p).trim();
      if (text === heading) return row;
    }
  }
  return null;
}

/** Direct `w:tr` children of a table (skips `w:tblPr`, whitespace, etc.). */
export function getDirectTableRows(tbl: XmlElement): XmlElement[] {
  const rows: XmlElement[] = [];
  for (let node = tbl.firstChild; node; node = node.nextSibling) {
    if (node.nodeType === 1 && (node as XmlElement).localName === "tr") {
      rows.push(node as XmlElement);
    }
  }
  return rows;
}

export function rowIndexInTable(tbl: XmlElement, target: XmlElement): number {
  return getDirectTableRows(tbl).indexOf(target);
}

/** Remove every content row after a section heading until the next Heading1 or end of table. */
export function removeRowsAfterHeading(tbl: XmlElement, headingRow: XmlElement): void {
  const rows = getDirectTableRows(tbl);
  const start = rowIndexInTable(tbl, headingRow);
  if (start < 0) return;
  const toRemove: XmlElement[] = [];
  for (let i = start + 1; i < rows.length; i++) {
    const paras = rows[i]!.getElementsByTagNameNS(W_NS, "p");
    for (let j = 0; j < paras.length; j++) {
      const style = paras.item(j)!.getElementsByTagNameNS(W_NS, "pStyle").item(0);
      if (style?.getAttributeNS(W_NS, "val") === "Heading1") return;
    }
    toRemove.push(rows[i]!);
  }
  for (const row of toRemove) row.parentNode?.removeChild(row);
}

/** Remove rows strictly between two heading rows (exclusive). */
export function removeRowsBetween(tbl: XmlElement, headStart: XmlElement, headEnd: XmlElement): void {
  const rows = getDirectTableRows(tbl);
  const a = rowIndexInTable(tbl, headStart);
  const b = rowIndexInTable(tbl, headEnd);
  if (a < 0 || b < 0 || b <= a) return;
  for (let i = b - 1; i > a; i--) {
    rows[i]!.parentNode?.removeChild(rows[i]!);
  }
}

/** @deprecated Use findSectionHeadingRow */
export function rowHeadingText(row: XmlElement): string {
  const paras = row.getElementsByTagNameNS(W_NS, "p");
  for (let j = 0; j < paras.length; j++) {
    const p = paras.item(j)!;
    const style = p.getElementsByTagNameNS(W_NS, "pStyle").item(0);
    if (style?.getAttributeNS(W_NS, "val") === "Heading1") {
      return collectText(p).trim();
    }
  }
  const cells = row.getElementsByTagNameNS(W_NS, "tc");
  return collectText(cells.item(cells.length - 1) ?? row).trim();
}
