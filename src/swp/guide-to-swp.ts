import { normalizeWikiPlaintext, stripHtml } from "../format.js";
import type { HydratedGuide } from "../types.js";
import { introductionPlainWithImages } from "./step-images.js";
import { stepToProcessRows, type SwpProcessRow } from "./process-rows.js";

export type { SwpProcessRow };

export interface SwpGuideContent {
  title: string;
  overviewLines: string[];
  overviewImageUrl?: string;
  processRows: SwpProcessRow[];
  conclusion?: string;
}

/** Map a Dozuki guide into SWP Overview + Process content (appendices stay in template). */
export function guideToSwpContent(guide: HydratedGuide): SwpGuideContent {
  const title =
    guide.title ||
    (guide.category && guide.type ? `${guide.category} — ${guide.type}` : `Guide ${guide.guideid ?? ""}`);

  const { paragraphs: introParagraphs, imageUrl: overviewImageUrl } =
    introductionPlainWithImages(guide);
  const overviewLines: string[] = [...introParagraphs];
  if (guide.parts?.length) {
    for (const p of guide.parts) {
      const qty = p.quantity ?? 1;
      const label = `${qty}× ${p.text ?? "?"}`;
      overviewLines.push(p.isoptional ? `${label} (optional)` : label);
    }
  }

  const processRows: SwpProcessRow[] = [];
  for (const [i, step] of (guide.steps ?? []).entries()) {
    processRows.push(...stepToProcessRows(step, i + 1));
  }

  const conclusion = normalizeWikiPlaintext(
    guide.conclusion_raw?.trim() || stripHtml(guide.conclusion_rendered || ""),
  );

  return {
    title,
    overviewLines: overviewLines.length ? overviewLines : ["(No overview content from Dozuki.)"],
    overviewImageUrl,
    processRows:
      processRows.length ?
        processRows
      : [{ text: "(No steps.)", callouts: [], stepNumber: 1 }],
    conclusion: conclusion || undefined,
  };
}
