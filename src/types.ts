export type DozukiAuth =
  | { kind: "bearer"; token: string }
  | { kind: "api-header"; apiKey: string; appId?: string };

export interface DozukiClientOptions {
  baseUrl: string;
  auth?: DozukiAuth;
  fetchFn?: typeof fetch;
}

/** Minimal guide shape returned by GET /api/2.0/guides/{guideid} */
export interface GuideLine {
  text_raw?: string;
  text_rendered?: string;
  bullet?: string;
  level?: number;
}

export interface GuideStep {
  title?: string;
  lines?: GuideLine[];
  stepid?: number;
  guideid?: number;
  orderby?: number;
  imageURL?: string;
  media?: { type?: string; data?: unknown[] };
}

export interface GuideDocument {
  documentid?: number;
  title?: string;
  filename?: string;
  url?: string;
  download_url?: string;
}

export interface DozukiGuide {
  guideid?: number;
  title?: string;
  type?: string;
  category?: string;
  difficulty?: string;
  url?: string;
  introduction_raw?: string;
  introduction_rendered?: string;
  conclusion_raw?: string;
  conclusion_rendered?: string;
  documents?: GuideDocument[];
  featured_document_embed_url?: string;
  featured_document_thumbnail_url?: string;
  steps?: GuideStep[];
  parts?: { text?: string; quantity?: number; url?: string; isoptional?: boolean }[];
}

export interface HydratedGuide extends DozukiGuide {
  documentDetails?: GuideDocument[];
}
