import fs from "node:fs";
import { exportGuideToSwpDocx } from "../src/swp/export-docx.js";
import { collectText, parseXml } from "../src/swp/ooxml-utils.js";
import type { HydratedGuide } from "../src/types.js";

const mockGuide: HydratedGuide = {
  guideid: 4,
  title: "TEST Dozuki Guide Title",
  introduction_raw: "This is Dozuki overview text from API.",
  steps: [
    {
      title: "First step",
      lines: [
        { bullet: "red", text_raw: "Turn the widget clockwise." },
        { bullet: "icon_note", text_raw: "Keep fingers clear." },
      ],
      imageURL: "https://example.com/step1.jpg",
    },
    {
      title: "Second step",
      lines: [{ bullet: "red", text_raw: "Inspect the result." }],
    },
  ],
};

const buf = await exportGuideToSwpDocx(mockGuide, {
  documentName: "TEST Dozuki Guide Title",
  department: "Test Dept",
});
fs.writeFileSync("/tmp/test-export.docx", buf);

const JSZip = (await import("jszip")).default;
const zip = await JSZip.loadAsync(buf);
const xml = await zip.file("word/document.xml")!.async("string");
const text = collectText(parseXml(xml).documentElement!);

const bandSawMarkers = [
  "guitar body blank",
  "band saw",
  "Glue Press",
  "template crate",
];
const dozukiMarkers = [
  "Dozuki overview",
  "Turn the widget",
  "TEST Dozuki Guide",
];

console.log("--- Band saw template text (should be ABSENT) ---");
for (const m of bandSawMarkers) {
  console.log(`  ${m}: ${text.includes(m) ? "STILL PRESENT ❌" : "removed ✓"}`);
}
console.log("--- Dozuki content (should be PRESENT) ---");
for (const m of dozukiMarkers) {
  console.log(`  ${m}: ${text.includes(m) ? "present ✓" : "MISSING ❌"}`);
}

const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const body = parseXml(xml).getElementsByTagNameNS(W, "body").item(0)!;
const { findTableWithHeading, getDirectTableRows } = await import("../src/swp/ooxml-utils.js");
const ov = findTableWithHeading(body, "Overview")!;
const pr = findTableWithHeading(body, "Process")!;
console.log("\nOverview rows:");
for (const [i, row] of getDirectTableRows(ov).entries()) {
  console.log(`  ${i}: ${collectText(row).slice(0, 70).replace(/\s+/g, " ")}`);
}
console.log("\nProcess rows:");
for (const [i, row] of getDirectTableRows(pr).entries()) {
  console.log(`  ${i}: ${collectText(row).slice(0, 70).replace(/\s+/g, " ")}`);
}
