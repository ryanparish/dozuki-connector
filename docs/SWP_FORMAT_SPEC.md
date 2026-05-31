# Gibson SWP Word format spec

Derived from `templates/swp-reference.docx` (Band Saw Bodies — Z01).

## What this document really is

This is not a simple “headings + paragraphs” Word doc. It is a **Standard Work Procedure (SWP)** built from **large tables** with a repeating **3-column step layout**. Most procedure content lives inside table cells, not as free-floating body text.

| Stat | Value |
|------|-------|
| Tables | 11 |
| Embedded images | 26 media files, ~40 inline drawings |
| Named paragraph styles (heavily used) | `Heading1`, `Heading2`, `Heading3`, `ListParagraph`, `NumberedList-Top`, TOC styles |

## Document skeleton (in order)

1. **Revision / version grid** (Table 1) — `Version`, `Date`, `Author`, `Summary`; rows A01–A08 + doc id (e.g. Z01).
2. **Icon Glossary** (Table 2) — `Heading1` + rows: icon image | callout definition.
3. **Overview + Set-up** (Table 3, ~19 rows) — mixed section headings, bullets, warnings, photos.
4. **Stray setup row** (Table 4) — occasional overflow row (same 3-col pattern).
5. **Process** (Table 5, ~13 rows) — main numbered work steps + warnings + “Step Complete”.
6. **Appendix A — Gibson Glossary** (Table 6) — terms tables + orientation (often static boilerplate).
7. **Guitar orientation** (Tables 7–8) — diagram + labels.
8. **Appendix B — 5S Workstation** (Table 9) — static 5S text + image.
9. **Revision History** (Table 10) — empty grid for sign-off metadata.
10. **Proposed Change Approvals** (Table 11) — signature grid.

**Header** (every page): Department, Safety Score, Date, Revision, Document Name, Author, Document Number, Approved By.

## The critical pattern: 3-column procedure row

Most steps (Overview, Set-up, Process) use **3 columns**:

| Col 1 | Col 2 | Col 3 |
|-------|-------|-------|
| Optional icon / photo / empty | **Procedure text** (`ListParagraph` or `NumberedList-Top`) | **Callout** (Warning / Caution / Note) and/or photo |

- **Col 2** = primary instruction (maps to Dozuki step lines, `text_raw` / bullets).
- **Col 3** = safety/quality callouts (maps to Dozuki bullet types `icon_note`, `orange`, etc.).
- **Col 1** = illustrative images or glossary icons.

### List numbering (Word `numId`)

| numId | Used in | Role |
|-------|---------|------|
| 1 | Overview | Unordered overview bullets |
| 2 | Set-up | Setup substeps (`ListParagraph` + some `NumberedList-Top`) |
| 24 | Process | **Main process step list** (`NumberedList-Top` for major steps) |

Nested substeps use `ilvl=1` under the same `numId` (e.g. Example line under blade tension).

## Section headings

| Word style | SWP meaning | Dozuki source (proposed) |
|------------|-------------|---------------------------|
| `Heading1` | Major section | Manual / config: Overview, Set-up, Process, Appendix titles |
| `Heading2` | Subsection | Sub-guides or tagged sections (rare in API) |
| `Heading3` | Sub-subsection | Category groupings |

Dozuki `guide.title` → header **Document Name** + title row, not automatically `Heading1` sections.

## Icon glossary ↔ Dozuki bullets

| Glossary / Col 3 prefix | Dozuki `line.bullet` |
|-------------------------|----------------------|
| Warning! (personal injury) | `icon_note` |
| Caution! (damage) | `orange`, `orange_warning` |
| Note: | `yellow` or plain note lines |
| Specifications/Best Practices | TBD / custom |
| Quality/Goals | `purple` |
| Variation / Testing / Eco-Friendly / Step Complete | Template-only or tags |

## Dozuki → SWP mapping (export logic)

```
HydratedGuide
├── metadata → header fields + Table 1 (revision) + Table 10/11
├── introduction → Table 3 “Overview” rows (Col 2 bullets)
├── parts[]      → Overview bullets or dedicated table (if required)
├── steps[]      → Table 5 “Process” rows (clone 3-col row per line group)
│   ├── step.title → optional bold line in Col 2 (template has no separate step title style)
│   ├── lines[] (bullet=red) → Col 2 ListParagraph / NumberedList-Top (numId 24)
│   ├── lines[] (icon_note, orange, …) → Col 3 callout text + icon image from glossary
│   └── step.media / imageURL → Col 1 or Col 3 image
├── conclusion → last Process row or Overview footer
└── documents[] → not in reference; attach as extra section or links table
```

## Recommended implementation

1. **Keep `templates/swp-reference.docx`** as the style/layout master (do not generate styles from scratch).
2. **Build a `GuideDocument` IR** in TypeScript (shared with Markdown export).
3. **Word export engine**: clone template tables and fill rows — prefer **`docx` npm** or **OOXML row cloning** from the reference file. **Pandoc is a poor fit** because it cannot preserve this table-centric SWP layout.
4. **Phase 1 scope**: header metadata + Overview (intro) + Process (steps only). Leave Icon Glossary, Appendices, Revision grids as template boilerplate.
5. **Phase 2**: map callout bullets to Col 3 with glossary icons; hydrate images from Dozuki URLs.

## API / UI (implemented)

**Pipeline:** Dozuki JSON → fill `templates/swp-reference.docx` → HTML (mammoth) / PDF (puppeteer).

- `GET /dozuki/:guideid/docx` — filled Gibson SWP Word file (source of truth for layout)
- `GET /dozuki/:guideid/html` — read-only HTML converted from filled template
- `GET /dozuki/:guideid/pdf` — read-only PDF from that HTML
- Query params: `documentName`, `documentNumber`, `department`, `author`, `revision`, `date`

Icon glossary, appendices, revision grids: **unchanged from the Word template** (not re-styled as Dozuki).
