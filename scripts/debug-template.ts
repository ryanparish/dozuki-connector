import fs from "node:fs";
import JSZip from "jszip";
import {
  collectText,
  findTableWithHeading,
  parseXml,
  rowHeadingText,
} from "../src/swp/ooxml-utils.js";

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const buf = fs.readFileSync("./templates/swp-reference.docx");
const zip = await JSZip.loadAsync(buf);
const docXml = await zip.file("word/document.xml")!.async("string");
const doc = parseXml(docXml);
const body = doc.getElementsByTagNameNS(W, "body").item(0)!;

const overviewTbl = findTableWithHeading(body, "Overview");
const processTbl = findTableWithHeading(body, "Process");
console.log("overviewTbl", !!overviewTbl, "processTbl", !!processTbl);

for (const [name, tbl] of [
  ["Overview", overviewTbl],
  ["Process", processTbl],
] as const) {
  if (!tbl) continue;
  const rows = tbl.getElementsByTagNameNS(W, "tr");
  console.log(`\n=== ${name}: ${rows.length} rows ===`);
  for (let i = 0; i < rows.length; i++) {
    const row = rows.item(i)!;
    console.log(
      `  ${i}: h=${JSON.stringify(rowHeadingText(row))} | ${collectText(row).slice(0, 70).replace(/\s+/g, " ")}`,
    );
  }
}
