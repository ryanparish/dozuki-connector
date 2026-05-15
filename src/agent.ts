import { DozukiClient } from "./client.js";
import { guideToMarkdown } from "./format.js";
import type { DozukiClientOptions, GuideDocument, HydratedGuide } from "./types.js";

export interface FetchFormattedGuideOpts extends DozukiClientOptions {
  guideid: number;
  /** Try GET /documents/{id} for each guide.documents[].documentid */
  hydrateDocuments?: boolean;
  /** Passed to GET /guides/{guideid} */
  guideQuery?: Record<string, string | boolean | number>;
}

export async function fetchFormattedMarkdown(opts: FetchFormattedGuideOpts): Promise<string> {
  const { guideid, hydrateDocuments = false, guideQuery, ...clientOpts } = opts;
  const client = new DozukiClient(clientOpts);
  const guide = await client.getGuide(guideid, { includeComments: false, ...guideQuery });
  const hydrated: HydratedGuide = { ...guide };

  if (hydrateDocuments && guide.documents?.length) {
    const details = await Promise.all(
      guide.documents
        .map((d) => d.documentid)
        .filter((id): id is number => typeof id === "number")
        .map((id) => client.tryGetDocument(id)),
    );
    hydrated.documentDetails = details.filter(Boolean) as GuideDocument[];
  }

  return guideToMarkdown(hydrated);
}

export { DozukiClient };
