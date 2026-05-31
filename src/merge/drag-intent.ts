import type { StepSnapshot } from "./signatures.js";
import { stepsMatch } from "./signatures.js";

export type DropAction = "replace" | "insert";

export type CompareRow = {
  kind: "aligned" | "pivot_only" | "variant_only";
  similarity: number | null;
  steps: (StepSnapshot | null)[];
};

/**
 * Contextual drop: replace when dropping onto the same aligned process step;
 * insert when the source step is unique to a variant guide.
 */
export function resolveDropAction(
  source: StepSnapshot,
  targetRow: CompareRow,
  masterGuideIndex: number,
  pivotGuideIndex: number,
): DropAction {
  const master = targetRow.steps[masterGuideIndex];
  const pivot = targetRow.steps[pivotGuideIndex];
  const sourceInRow = targetRow.steps.some(
    (s) => s && s.guideid === source.guideid && s.stepid === source.stepid,
  );

  if (targetRow.kind === "variant_only") return "insert";

  if (sourceInRow && master && source.guideid !== master.guideid) {
    return "replace";
  }

  if (targetRow.kind === "aligned" && targetRow.similarity != null && targetRow.similarity > 0) {
    if (master && source.guideid !== master.guideid) return "replace";
  }

  if (pivot && source.guideid !== pivot.guideid && stepsMatch(source, pivot)) {
    return "replace";
  }

  if (master && stepsMatch(source, master)) return "replace";

  if (!master) return "insert";

  return "insert";
}
