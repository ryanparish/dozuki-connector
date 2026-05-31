import type JSZip from "jszip";
import { parseXml, serializeXml, type XmlDocument, type XmlElement } from "./ooxml-utils.js";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
const A = "http://schemas.openxmlformats.org/drawingml/2006/main";
const PIC = "http://schemas.openxmlformats.org/drawingml/2006/picture";
const REL_EMBED = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function q(ns: string, tag: string): string {
  return `{${ns}}${tag}`;
}

/** Add image to docx zip; return relationship id (e.g. rId42). */
export async function addImageToDocx(
  zip: JSZip,
  imageBytes: Buffer,
  contentType: string,
): Promise<string> {
  const relsPath = "word/_rels/document.xml.rels";
  const relsFile = zip.file(relsPath);
  if (!relsFile) throw new Error("Missing word/_rels/document.xml.rels");

  const relsXml = await relsFile.async("string");
  const relsDoc = parseXml(relsXml);
  const rels = relsDoc.documentElement;
  if (!rels) throw new Error("Invalid document.xml.rels");

  let maxId = 0;
  for (const rel of rels.getElementsByTagNameNS(R, "Relationship")) {
    const id = rel.getAttribute("Id") || "";
    const m = /^rId(\d+)$/.exec(id);
    if (m) maxId = Math.max(maxId, Number(m[1]));
  }
  const newId = maxId + 1;
  const rId = `rId${newId}`;
  const ext = contentType.includes("png") ? "png" : "jpeg";
  const mediaPath = `word/media/export-${newId}.${ext}`;

  const rel = relsDoc.createElementNS(R, "Relationship");
  rel.setAttribute("Id", rId);
  rel.setAttribute("Type", `${REL_EMBED}/image`);
  rel.setAttribute("Target", `media/export-${newId}.${ext}`);
  rels.appendChild(rel);

  zip.file(relsPath, serializeXml(relsDoc));
  zip.file(mediaPath, imageBytes);

  const contentTypes = await zip.file("[Content_Types].xml")?.async("string");
  if (contentTypes && !contentTypes.includes(`export-${newId}.${ext}`)) {
    const ct = contentType.includes("png") ? "image/png" : "image/jpeg";
    const insert = `<Default Extension="${ext}" ContentType="${ct}"/>`;
    zip.file(
      "[Content_Types].xml",
      contentTypes.replace("</Types>", `${insert}</Types>`),
    );
  }

  return rId;
}

/** Replace first cell's content with a simple inline image drawing. */
export function setCellImage(cell: XmlElement, rId: string, doc: XmlDocument): void {
  while (cell.firstChild) cell.removeChild(cell.firstChild);

  const p = doc.createElementNS(W, "w:p");
  const r = doc.createElementNS(W, "w:r");
  const drawing = doc.createElementNS(W, "w:drawing");
  const inline = doc.createElementNS(WP, "wp:inline");
  inline.setAttribute("distT", "0");
  inline.setAttribute("distB", "0");
  inline.setAttribute("distL", "0");
  inline.setAttribute("distR", "0");

  const extent = doc.createElementNS(WP, "wp:extent");
  extent.setAttribute("cx", "2743200");
  extent.setAttribute("cy", "2057400");
  inline.appendChild(extent);

  const docPr = doc.createElementNS(WP, "wp:docPr");
  docPr.setAttribute("id", String(Math.floor(Math.random() * 1e9)));
  docPr.setAttribute("name", "Dozuki export");
  inline.appendChild(docPr);

  const graphic = doc.createElementNS(A, "a:graphic");
  const graphicData = doc.createElementNS(A, "a:graphicData");
  graphicData.setAttribute("uri", PIC);

  const pic = doc.createElementNS(PIC, "pic:pic");
  const nvPicPr = doc.createElementNS(PIC, "pic:nvPicPr");
  const cNvPr = doc.createElementNS(PIC, "pic:cNvPr");
  cNvPr.setAttribute("id", "0");
  cNvPr.setAttribute("name", "export");
  nvPicPr.appendChild(cNvPr);
  pic.appendChild(nvPicPr);

  const blipFill = doc.createElementNS(PIC, "pic:blipFill");
  const blip = doc.createElementNS(A, "a:blip");
  blip.setAttributeNS(R, "embed", rId);
  blipFill.appendChild(blip);
  const stretch = doc.createElementNS(A, "a:stretch");
  const fillRect = doc.createElementNS(A, "a:fillRect");
  stretch.appendChild(fillRect);
  blipFill.appendChild(stretch);
  pic.appendChild(blipFill);

  const spPr = doc.createElementNS(PIC, "pic:spPr");
  const xfrm = doc.createElementNS(A, "a:xfrm");
  const off = doc.createElementNS(A, "a:off");
  off.setAttribute("x", "0");
  off.setAttribute("y", "0");
  const ext = doc.createElementNS(A, "a:ext");
  ext.setAttribute("cx", "2743200");
  ext.setAttribute("cy", "2057400");
  xfrm.appendChild(off);
  xfrm.appendChild(ext);
  spPr.appendChild(xfrm);
  const prstGeom = doc.createElementNS(A, "a:prstGeom");
  prstGeom.setAttribute("prst", "rect");
  spPr.appendChild(prstGeom);
  pic.appendChild(spPr);

  graphicData.appendChild(pic);
  graphic.appendChild(graphicData);
  inline.appendChild(graphic);
  drawing.appendChild(inline);
  r.appendChild(drawing);
  p.appendChild(r);
  cell.appendChild(p);
}

/** First table cell in a row (accent / photo column). */
export function rowAccentCell(row: XmlElement): XmlElement | null {
  return row.getElementsByTagNameNS(W, "tc").item(0);
}
