import type { GuideLine, GuideStep } from "../types.js";

const MATCH_THRESHOLD = 0.5;

export { MATCH_THRESHOLD };

export type StepSnapshot = {
  guideid: number;
  stepid?: number;
  orderby?: number;
  title?: string;
  linePreview: string;
  lineCount: number;
  hasImage: boolean;
  bullets: string[];
  signature: string;
};

function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function primaryLine(lines: GuideLine[] | undefined): string {
  if (!lines?.length) return "";
  for (const line of lines) {
    const t = (line.text_raw ?? line.text_rendered ?? "").trim();
    if (t) return t;
  }
  return "";
}

/** Stable fingerprint for alignment and diff. */
export function stepSignature(step: GuideStep): string {
  const title = normalizeText(step.title ?? "");
  const body = normalizeText(primaryLine(step.lines));
  const bullets = (step.lines ?? [])
    .map((l) => l.bullet ?? "")
    .filter(Boolean)
    .join(",");
  const img = step.imageURL || step.media?.data?.length ? "1" : "0";
  return [title, body, bullets, img].join("|");
}

export function snapshotStep(step: GuideStep, guideid: number): StepSnapshot {
  const lines = step.lines ?? [];
  const preview = primaryLine(lines);
  return {
    guideid,
    stepid: step.stepid,
    orderby: step.orderby,
    title: step.title,
    linePreview: preview.length > 120 ? `${preview.slice(0, 117)}…` : preview,
    lineCount: lines.length,
    hasImage: Boolean(step.imageURL || step.media?.data?.length),
    bullets: lines.map((l) => l.bullet ?? "").filter(Boolean),
    signature: stepSignature(step),
  };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) d[i][0] = i;
  for (let j = 0; j < cols; j++) d[0][j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[rows - 1][cols - 1];
}

function textSimilarity(a: string, b: string): number {
  const x = normalizeText(a);
  const y = normalizeText(b);
  if (!x && !y) return 1;
  if (!x || !y) return 0;
  const dist = levenshtein(x, y);
  return 1 - dist / Math.max(x.length, y.length);
}

/** 0–1 similarity between two steps (title + body + bullets). */
export function stepSimilarity(a: StepSnapshot, b: StepSnapshot): number {
  const titleSim = textSimilarity(a.title ?? "", b.title ?? "");
  const bodySim = textSimilarity(
    a.signature.split("|")[1] ?? "",
    b.signature.split("|")[1] ?? "",
  );
  const bulletSim =
    a.bullets.join(",") === b.bullets.join(",") ? 1
    : a.bullets.length && b.bullets.length ? 0.5
    : 0;
  return titleSim * 0.25 + bodySim * 0.65 + bulletSim * 0.1;
}

export function stepsMatch(a: StepSnapshot, b: StepSnapshot): boolean {
  return stepSimilarity(a, b) >= MATCH_THRESHOLD;
}
