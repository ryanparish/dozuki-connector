# Clean SWP template checklist

Use this when preparing `templates/swp-reference.docx` for Dozuki export.

## What the exporter replaces today

| Template region | Behavior |
|-----------------|----------|
| **Header** (every page) | Swaps a few literals (document name, author, department, doc number, date, revision) |
| **Table 3 — Overview** | Removes sample rows between Overview and Set-up; inserts Dozuki introduction/parts |
| **Table 5 — Process** | Removes all sample steps; inserts Dozuki steps |
| **Everything else** | **Left unchanged** from your `.docx` |

## What still comes from the template (common “noise”)

1. **Table 1** — Version grid (A01–A08, Chris Talley, Gibson feedback, etc.)
2. **Table 2** — Icon Glossary (full static definitions)
3. **Table 3 — Set-up** — Heading row may remain even when empty; was filled with Band Saw setup steps
4. **Table 4** — Orphan overflow row (e.g. paraffin on worktable) — **Band Saw–specific**
5. **Tables 6–11** — Gibson glossary, guitar diagrams, 5S, revision history, approvals
6. **Sample photos** in cells unless Dozuki provides a replacement image for that row

## Recommended “shell” template

Keep structure and styles; **delete sample procedure text**:

- [ ] Overview: one empty 3-column row (or one placeholder bullet), no Glue Press / body blank text
- [ ] Set-up: **remove section entirely** if you don’t map Dozuki content there, or leave one empty row
- [ ] **Delete Table 4** (standalone overflow table) if present in your file
- [ ] Process: only the “Process” heading row + optional “Step Complete” row — **no Band Saw steps**
- [ ] Version / revision tables: empty rows or generic placeholders (not A05/A06 sample names)
- [ ] Keep Icon Glossary and appendices if you want them on every export

Save as `templates/swp-reference.docx` and restart the server.

## After you resubmit

Tell us if Set-up should be filled from Dozuki (e.g. prerequisite steps) or omitted entirely — that drives the next mapping change.
