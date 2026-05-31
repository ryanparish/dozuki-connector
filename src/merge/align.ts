import { MATCH_THRESHOLD, type StepSnapshot, stepSimilarity } from "./signatures.js";

export type PairAlignmentKind = "match" | "ref_only" | "other_only";

export type PairAlignment = {
  kind: PairAlignmentKind;
  refIndex: number | null;
  otherIndex: number | null;
  similarity: number | null;
};

const GAP_PENALTY = 0.85;

/**
 * Needleman–Wunsch alignment of pivot (ref) steps vs another guide.
 * Match score uses step similarity; gaps when similarity is below threshold.
 */
export function alignStepSequences(
  ref: StepSnapshot[],
  other: StepSnapshot[],
): PairAlignment[] {
  const n = ref.length;
  const m = other.length;
  if (n === 0 && m === 0) return [];
  if (n === 0) {
    return other.map((_, i) => ({
      kind: "other_only" as const,
      refIndex: null,
      otherIndex: i,
      similarity: null,
    }));
  }
  if (m === 0) {
    return ref.map((_, i) => ({
      kind: "ref_only" as const,
      refIndex: i,
      otherIndex: null,
      similarity: null,
    }));
  }

  const score = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  const trace = Array.from({ length: n + 1 }, () =>
    new Array<"diag" | "up" | "left" | null>(m + 1).fill(null),
  );

  for (let i = 1; i <= n; i++) {
    score[i][0] = score[i - 1][0] - GAP_PENALTY;
    trace[i][0] = "up";
  }
  for (let j = 1; j <= m; j++) {
    score[0][j] = score[0][j - 1] - GAP_PENALTY;
    trace[0][j] = "left";
  }

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const sim = stepSimilarity(ref[i - 1], other[j - 1]);
      const matchGain =
        sim >= MATCH_THRESHOLD ? sim * 2 : -GAP_PENALTY;
      const diag = score[i - 1][j - 1] + matchGain;
      const up = score[i - 1][j] - GAP_PENALTY;
      const left = score[i][j - 1] - GAP_PENALTY;
      let best = diag;
      let dir: "diag" | "up" | "left" = "diag";
      if (up > best) {
        best = up;
        dir = "up";
      }
      if (left > best) {
        best = left;
        dir = "left";
      }
      score[i][j] = best;
      trace[i][j] = dir;
    }
  }

  const raw: PairAlignment[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    const dir = trace[i][j];
    if (dir === "diag" && i > 0 && j > 0) {
      const sim = stepSimilarity(ref[i - 1], other[j - 1]);
      if (sim >= MATCH_THRESHOLD) {
        raw.push({
          kind: "match",
          refIndex: i - 1,
          otherIndex: j - 1,
          similarity: sim,
        });
      } else {
        raw.push({ kind: "ref_only", refIndex: i - 1, otherIndex: null, similarity: null });
        raw.push({ kind: "other_only", refIndex: null, otherIndex: j - 1, similarity: null });
      }
      i--;
      j--;
    } else if (dir === "up" && i > 0) {
      raw.push({ kind: "ref_only", refIndex: i - 1, otherIndex: null, similarity: null });
      i--;
    } else if (dir === "left" && j > 0) {
      raw.push({ kind: "other_only", refIndex: null, otherIndex: j - 1, similarity: null });
      j--;
    } else if (i > 0) {
      raw.push({ kind: "ref_only", refIndex: i - 1, otherIndex: null, similarity: null });
      i--;
    } else if (j > 0) {
      raw.push({ kind: "other_only", refIndex: null, otherIndex: j - 1, similarity: null });
      j--;
    } else {
      break;
    }
  }

  return raw.reverse();
}
