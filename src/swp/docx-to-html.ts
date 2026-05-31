import mammoth from "mammoth";

/** Mammoth style map — map Word SWP paragraph styles to HTML classes. */
const STYLE_MAP = [
  "p[style-name='heading 1'] => h2.swp-h1:fresh",
  "p[style-name='heading 2'] => h3.swp-h2:fresh",
  "p[style-name='heading 3'] => h4.swp-h3:fresh",
  "p[style-name='Title'] => h1.swp-title:fresh",
  "p[style-name='List Paragraph'] => p.swp-list:fresh",
  "p[style-name='Numbered List - Top'] => p.swp-numbered:fresh",
  "r[style-name='Strong'] => strong",
];

const TEMPLATE_CSS = `
  body {
    margin: 0;
    font-family: Calibri, "Segoe UI", Arial, sans-serif;
    font-size: 11pt;
    color: #000;
    background: #d9d9d9;
  }
  .readonly-banner {
    background: #1e3a5f;
    color: #fff;
    padding: 0.55rem 1rem;
    font-size: 0.85rem;
    text-align: center;
  }
  .mammoth-body {
    max-width: 10.5in;
    margin: 0.75rem auto 1.5rem;
    background: #fff;
    padding: 0.5in 0.45in;
    box-shadow: 0 2px 10px rgba(0,0,0,.12);
  }
  .mammoth-body table {
    width: 100%;
    border-collapse: collapse;
    margin: 0.35rem 0 0.75rem;
  }
  .mammoth-body td, .mammoth-body th {
    border: 1px solid #bfbfbf;
    padding: 4pt 6pt;
    vertical-align: top;
  }
  .mammoth-body img {
    max-width: 100%;
    height: auto;
  }
  .swp-h1 { color: #86764e; font-size: 14pt; font-weight: bold; margin: 12pt 0 6pt; }
  .swp-h2 { color: #86764e; font-size: 12pt; font-weight: bold; margin: 10pt 0 4pt; }
  .swp-h3 { color: #86764e; font-size: 11pt; font-weight: bold; margin: 8pt 0 4pt; }
  .swp-numbered { margin: 2pt 0; }
  .swp-list { margin: 2pt 0; }
  @media print {
    body { background: #fff; }
    .mammoth-body { box-shadow: none; margin: 0; max-width: none; }
  }
`;

/** Convert a filled SWP .docx (from our template) into read-only HTML. */
export async function docxToReadOnlyHtml(
  docx: Buffer,
  opts: { title?: string } = {},
): Promise<string> {
  const result = await mammoth.convertToHtml(
    { buffer: docx },
    { styleMap: STYLE_MAP, includeDefaultStyleMap: true },
  );
  const title = opts.title ? escapeHtml(opts.title) : "SWP Export";
  const warnings =
    result.messages.length ?
      `<!-- mammoth: ${result.messages.map((m) => m.message).join("; ")} -->`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>${title}</title>
  <style>${TEMPLATE_CSS}</style>
</head>
<body contenteditable="false">
  ${warnings}
  <div class="readonly-banner" role="note">
    <strong>Gibson SWP — read-only export.</strong>
    Content from Dozuki applied to the corporate Word template. Edit only in Dozuki.
  </div>
  <div class="mammoth-body">${result.value}</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
