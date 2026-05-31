import { stripHtml } from "../format.js";
import type { GuideStep, HydratedGuide } from "../types.js";

/** Best single image for a step (not every resize variant). */
export function pickPrimaryStepImage(step: GuideStep): string | undefined {
  if (typeof step.imageURL === "string" && step.imageURL.trim()) {
    return step.imageURL.trim();
  }
  if (step.media?.type === "image" && Array.isArray(step.media.data) && step.media.data.length) {
    const img = step.media.data[0];
    if (img && typeof img === "object") {
      const rec = img as Record<string, unknown>;
      for (const key of ["standard", "large", "medium", "original", "thumbnail"]) {
        const u = rec[key];
        if (typeof u === "string" && u.trim()) return u.trim();
      }
    }
  }
  return undefined;
}

/** Parse `<img src="...">` from Dozuki-rendered HTML snippets. */
export function extractHtmlImageUrls(html: string): string[] {
  const urls: string[] = [];
  const re = /<img[^>]+src=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]?.trim()) urls.push(m[1].trim());
  }
  return urls;
}

/** URLs to fetch/embed — one primary image per step plus intro/line extras. */
export function collectGuideImageUrls(guide: HydratedGuide): string[] {
  const urls: string[] = [];
  const introHtml = guide.introduction_rendered || "";
  const introImgs = extractHtmlImageUrls(introHtml);
  if (introImgs[0]) urls.push(introImgs[0]);

  for (const step of guide.steps ?? []) {
    const primary = pickPrimaryStepImage(step);
    if (primary) urls.push(primary);
    for (const line of step.lines ?? []) {
      const lineImg = extractHtmlImageUrls(line.text_rendered || "")[0];
      if (lineImg && lineImg !== primary) urls.push(lineImg);
    }
  }
  return [...new Set(urls.filter(Boolean))];
}

export function introductionPlainWithImages(guide: HydratedGuide): {
  paragraphs: string[];
  imageUrl?: string;
} {
  const intro = guide.introduction_raw?.trim() || stripHtml(guide.introduction_rendered || "");
  const paragraphs = intro ?
    intro.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  : [];
  const imageUrl = extractHtmlImageUrls(guide.introduction_rendered || "")[0];
  return { paragraphs, imageUrl };
}
