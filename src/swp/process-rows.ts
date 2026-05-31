import type { GuideLine, GuideStep } from "../types.js";
import { lineToInstruction, lineToSwpCallout } from "./callout-text.js";
import { extractHtmlImageUrls, pickPrimaryStepImage } from "./step-images.js";

export interface SwpProcessRow {
  text: string;
  callouts: string[];
  imageUrl?: string;
  stepNumber?: number;
}

function pickLineImage(line: GuideLine): string | undefined {
  return extractHtmlImageUrls(line.text_rendered || "")[0];
}

/** One SWP table row per instruction line; callouts on the same row (Col 3). */
export function stepToProcessRows(step: GuideStep, stepIndex: number): SwpProcessRow[] {
  const rows: SwpProcessRow[] = [];
  const lines = step.lines ?? [];
  const stepImage = pickPrimaryStepImage(step);
  let firstInstruction = true;

  for (const line of lines) {
    const callout = lineToSwpCallout(line);
    if (callout) {
      if (rows.length > 0) {
        rows[rows.length - 1]!.callouts.push(callout);
      } else {
        rows.push({ text: "", callouts: [callout], stepNumber: stepIndex });
      }
      continue;
    }

    const inst = lineToInstruction(line);
    if (!inst) continue;

    const lineImage = pickLineImage(line);
    const imageUrl = lineImage ?? (firstInstruction ? stepImage : undefined);
    const title = step.title?.trim();
    let text = inst;
    if (firstInstruction && title && !inst.startsWith(title)) {
      text = `${title}: ${inst}`;
    }

    rows.push({
      text,
      callouts: [],
      imageUrl,
      stepNumber: firstInstruction ? stepIndex : undefined,
    });
    firstInstruction = false;
  }

  if (rows.length === 0) {
    rows.push({
      text: step.title?.trim() || `Step ${stepIndex}`,
      callouts: [],
      imageUrl: stepImage,
      stepNumber: stepIndex,
    });
  }

  return rows;
}
