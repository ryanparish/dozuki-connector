import type { HydratedGuide } from "../types.js";

export interface SwpExportMeta {
  department?: string;
  documentName?: string;
  documentNumber?: string;
  author?: string;
  revision?: string;
  date?: string;
}

export function resolveSwpMeta(guide: HydratedGuide, meta: SwpExportMeta = {}): Required<
  Pick<SwpExportMeta, "documentName" | "documentNumber" | "department" | "author" | "revision" | "date">
> {
  return {
    documentName: meta.documentName || guide.title || "Dozuki Guide",
    documentNumber: meta.documentNumber || `SWP-GUIDE-${guide.guideid ?? "export"}`,
    department: meta.department || guide.category || "",
    author: meta.author ?? "",
    revision: meta.revision ?? "1.0",
    date:
      meta.date ??
      new Date().toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      }),
  };
}

export function swpExportBasename(guide: HydratedGuide): string {
  const base =
    (guide.title || `guide-${guide.guideid ?? "export"}`)
      .replace(/[^\w\s-]+/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .slice(0, 60) || "dozuki-export";
  return base;
}
