import type { GuideDocument, GuideLine, GuideStep, HydratedGuide } from "./types.js";

/** Turn common Dozuki wiki-ish patterns into Markdown. */
export function normalizeWikiPlaintext(text: string): string {
  return text.replace(/\[video\|([^\]\s]+)\]/gi, "[$1]($1)");
}

/** Strip trivial HTML/spans — good enough for intro/conclusion snippets. */
export function stripHtml(html: string): string {
  return html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*p[^>]*>/gi, "\n")
    .replace(/<\/\s*p\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const BULLET_PREFIX: Record<string, string> = {
  icon_note: "> **Note:** ",
  orange: "**Caution:** ",
  orange_warning: "**Caution:** ",
  yellow: "**Tip:** ",
  red: "",
  purple: "**Important:** ",
};

function indentForLevel(level: number): string {
  return "  ".repeat(Math.min(Math.max(level, 0), 8));
}

function lineToMarkdown(line: GuideLine): string {
  const text = line.text_raw?.trim() || stripHtml(line.text_rendered || "");
  if (!text) return "";
  const bullet = line.bullet || "red";
  const prefix = BULLET_PREFIX[bullet] ?? "";
  const base = prefix + text;
  return indentForLevel(line.level ?? 0) + (prefix.startsWith(">") ? base : `- ${base}`);
}

function stepToMarkdown(step: GuideStep, index: number): string {
  const lines = (step.lines ?? [])
    .map(lineToMarkdown)
    .filter(Boolean)
    .join("\n");
  const title = step.title?.trim();
  const head = title ? `### Step ${index}: ${title}` : `### Step ${index}`;
  const images = extractImageUrls(step);
  const media =
    images.length > 0
      ? `\n\n${images.map((u) => `![step ${index}](${u})`).join("\n")}`
      : "";
  return `${head}\n\n${lines || "_No bullet lines._"}${media}`;
}

function extractImageUrls(step: GuideStep): string[] {
  const urls: string[] = [];
  if (step.media?.type === "image" && Array.isArray(step.media.data)) {
    for (const img of step.media.data) {
      if (img && typeof img === "object" && "standard" in img && typeof img.standard === "string")
        urls.push(img.standard as string);
    }
  }
  if (urls.length === 0 && typeof step.imageURL === "string") urls.push(step.imageURL);
  return urls;
}

function documentsSection(docs: GuideDocument[]): string {
  if (!docs.length) return "";
  const lines = docs.map((d, i) => {
    const name = d.title || d.filename || `Document ${d.documentid ?? i + 1}`;
    const link = d.download_url || d.url;
    return link ? `- [${name}](${link})` : `- ${name}`;
  });
  return `## Attached documents\n\n${lines.join("\n")}`;
}

/** Turn a hydrated guide plus optional extra document rows into readable Markdown. */
export function guideToMarkdown(g: HydratedGuide): string {
  const title =
    g.title || (g.category && g.type ? `${g.category} — ${g.type}` : `Guide ${g.guideid ?? ""}`);
  const meta: string[] = [];
  if (g.category) meta.push(`Category: ${g.category}`);
  if (g.difficulty) meta.push(`Difficulty: ${g.difficulty}`);
  if (g.url) meta.push(`Source: ${g.url}`);

  const intro =
    normalizeWikiPlaintext(
      g.introduction_raw?.trim() || stripHtml(g.introduction_rendered || ""),
    );
  const conclusion =
    normalizeWikiPlaintext(
      g.conclusion_raw?.trim() || stripHtml(g.conclusion_rendered || ""),
    );

  const parts =
    g.parts?.length ?
      "## Parts\n\n" +
      g.parts
        .map(
          (p) =>
            `- ${p.quantity ?? 1}× ${p.text ?? "?"}${p.isoptional ? " _(optional)_" : ""}${p.url ? ` — ${p.url}` : ""}`,
        )
        .join("\n")
    : "";

  const steps = (g.steps ?? []).map((s, i) => stepToMarkdown(s, i + 1)).join("\n\n");

  const docList = [...(g.documents ?? []), ...(g.documentDetails ?? [])].filter(
    (d, i, a) =>
      a.findIndex(
        (x) => (x.documentid != null && x.documentid === d.documentid) || x === d,
      ) === i,
  );
  const docsBlock = documentsSection(docList);

  const featured =
    g.featured_document_embed_url ?
      `\n## Featured document\n\n${g.featured_document_embed_url}\n`
    : "";

  return [
    `# ${title}`,
    "",
    meta.map((m) => `_${m}_`).join(" · "),
    "",
    intro ? `## Introduction\n\n${intro}` : "",
    parts,
    "## Steps",
    "",
    steps || "_No steps._",
    featured,
    conclusion ? `## Conclusion\n\n${conclusion}` : "",
    docsBlock,
  ]
    .filter((b) => b !== "")
    .join("\n\n");
}
