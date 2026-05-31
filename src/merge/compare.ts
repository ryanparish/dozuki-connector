import { alignStepSequences } from "./align.js";
import { resolveDropAction, type CompareRow, type DropAction } from "./drag-intent.js";
import { snapshotStep, type StepSnapshot } from "./signatures.js";
import type { DozukiGuide } from "../types.js";

export type GuideSummary = {
  guideIndex: number;
  guideid: number;
  title?: string;
  stepCount: number;
  revisionid?: number;
};

export type CompareRowPayload = CompareRow & {
  rowIndex: number;
  dropActions: DropAction[];
};

export type VariantOnlyGroup = {
  guideIndex: number;
  guideid: number;
  steps: StepSnapshot[];
};

export type CompareResult = {
  pivotGuideIndex: number;
  guides: GuideSummary[];
  rows: CompareRowPayload[];
  variantOnly: VariantOnlyGroup[];
};

function emptyRow(guideCount: number): (StepSnapshot | null)[] {
  return Array.from({ length: guideCount }, () => null);
}

function classifyRow(steps: (StepSnapshot | null)[], similarity: number | null): CompareRow["kind"] {
  const filled = steps.filter(Boolean).length;
  if (filled <= 1) return steps[0] ? "pivot_only" : "variant_only";
  if (similarity != null && similarity > 0) return "aligned";
  return "pivot_only";
}

export function compareGuides(
  guides: DozukiGuide[],
  pivotGuideIndex = 0,
): CompareResult {
  if (guides.length < 2) {
    throw new Error("At least two guides are required for comparison");
  }
  if (pivotGuideIndex < 0 || pivotGuideIndex >= guides.length) {
    throw new Error("Invalid pivot guide index");
  }

  const guideCount = guides.length;
  const snapshots = guides.map((g, gi) =>
    (g.steps ?? []).map((s) => snapshotStep(s, g.guideid ?? gi)),
  );

  const pivotSnaps = snapshots[pivotGuideIndex];
  const rows: CompareRow[] = pivotSnaps.map((s) => {
    const steps = emptyRow(guideCount);
    steps[pivotGuideIndex] = s;
    return { kind: "pivot_only" as const, similarity: null, steps };
  });

  const variantOnly: VariantOnlyGroup[] = [];

  for (let g = 0; g < guideCount; g++) {
    if (g === pivotGuideIndex) continue;
    const pairs = alignStepSequences(
      snapshots[pivotGuideIndex],
      snapshots[g],
    );
    const orphans: StepSnapshot[] = [];

    for (const pair of pairs) {
      if (pair.kind === "match" && pair.refIndex != null && pair.otherIndex != null) {
        const row = rows[pair.refIndex];
        row.steps[g] = snapshots[g][pair.otherIndex];
        row.similarity =
          row.similarity == null ?
            pair.similarity
          : Math.max(row.similarity ?? 0, pair.similarity ?? 0);
        row.kind = classifyRow(row.steps, row.similarity);
      } else if (pair.kind === "other_only" && pair.otherIndex != null) {
        orphans.push(snapshots[g][pair.otherIndex]);
      }
    }

    if (orphans.length) {
      variantOnly.push({
        guideIndex: g,
        guideid: guides[g].guideid ?? g,
        steps: orphans,
      });
    }
  }

  const summaries: GuideSummary[] = guides.map((g, gi) => ({
    guideIndex: gi,
    guideid: g.guideid ?? gi,
    title: g.title,
    stepCount: g.steps?.length ?? 0,
    revisionid: (g as { revisionid?: number }).revisionid,
  }));

  const payloadRows: CompareRowPayload[] = rows.map((row, rowIndex) => {
    const dropActions: DropAction[] = [];
    for (let g = 0; g < guideCount; g++) {
      const step = row.steps[g];
      if (!step || g === pivotGuideIndex) {
        dropActions.push("insert");
        continue;
      }
      dropActions.push(resolveDropAction(step, row, pivotGuideIndex, pivotGuideIndex));
    }
    return { ...row, rowIndex, dropActions };
  });

  return {
    pivotGuideIndex,
    guides: summaries,
    rows: payloadRows,
    variantOnly,
  };
}
