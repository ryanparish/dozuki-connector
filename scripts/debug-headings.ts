import fs from "node:fs";
import JSZip from "jszip";
import {
  collectText,
  findSectionHeadingRow,
  findTableWithHeading,
  getDirectTableRows,
  parseXml,
  rowIndexInTable,
} from "../src/swp/ooxml-utils.js";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const buf = fs.readFileSync("./templates/swp-reference.docx");
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml")!.async("string");
const body = parseXml(xml).getElementsByTagNameNS(W, "body").item(0)!;
const tbl = findTableWithHeading(body, "Overview")!;

const ov = findSectionHeadingRow(tbl, "Overview")!;
const su = findSectionHeadingRow(tbl, "Set-up")!;
const rows = getDirectTableRows(tbl);

console.log("direct rows:", rows.length);
console.log("Overview index:", rowIndexInTable(tbl, ov));
console.log("Set-up index:", rowIndexInTable(tbl, su));
console.log("Set-up row text:", collectText(su).slice(0, 40));

for (const [i, row] of rows.entries()) {
  const paras = row.getElementsByTagNameNS(W, "p");
  for (let j = 0; j < paras.length; j++) {
    const p = paras.item(j)!;
    const style = p.getElementsByTagNameNS(W, "pStyle").item(0);
    if (style?.getAttributeNS(W, "val") === "Heading1") {
      console.log(`  row ${i} Heading1: ${collectText(p).trim()}`);
    }
  }
}
