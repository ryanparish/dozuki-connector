import type { GuideLine } from "../types.js";
import { stripHtml } from "../format.js";

/** SWP Col-3 callout prefixes aligned with the Icon Glossary template. */
export function lineToSwpCallout(line: GuideLine): string | undefined {
  const text = line.text_raw?.trim() || stripHtml(line.text_rendered || "");
  if (!text) return undefined;
  const bullet = line.bullet || "red";
  switch (bullet) {
    case "icon_note":
      return text.startsWith("Warning!") ? text : `Warning! ${text}`;
    case "orange":
    case "orange_warning":
      return text.startsWith("Caution!") ? text : `Caution! ${text}`;
    case "yellow":
      return text.startsWith("Note:") ? text : `Note: ${text}`;
    case "purple":
      return text.startsWith("Quality") ? text : `Quality/Goals: ${text}`;
    default:
      return undefined;
  }
}

export function lineToInstruction(line: GuideLine): string | undefined {
  const bullet = line.bullet || "red";
  if (bullet !== "red" && bullet !== "") return undefined;
  const text = line.text_raw?.trim() || stripHtml(line.text_rendered || "");
  return text || undefined;
}
