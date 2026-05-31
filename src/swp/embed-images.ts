import type { DozukiAuth } from "../types.js";

export type EmbeddedImages = Map<string, string>;

function authHeaders(auth?: DozukiAuth): Headers {
  const h = new Headers();
  if (!auth) return h;
  if (auth.kind === "bearer") {
    h.set("Authorization", `Bearer ${auth.token}`);
  } else {
    h.set("Authorization", `api ${auth.apiKey}`);
    if (auth.appId) h.set("X-App-Id", auth.appId);
  }
  return h;
}

export function resolveAssetUrl(url: string, baseUrl: string): string {
  const t = url.trim();
  if (!t) return t;
  if (t.startsWith("http://") || t.startsWith("https://")) return t;
  if (t.startsWith("//")) return `https:${t}`;
  const base = baseUrl.replace(/\/+$/, "");
  return t.startsWith("/") ? `${base}${t}` : `${base}/${t}`;
}

function guessMime(url: string, header?: string | null): string {
  if (header && header.startsWith("image/")) return header.split(";")[0]!.trim();
  const lower = url.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

export interface FetchedImages {
  /** original URL → data URI */
  uris: EmbeddedImages;
  /** original URL → raw bytes */
  bytes: Map<string, Buffer>;
  /** original URL → MIME type */
  mime: Map<string, string>;
}

/** Fetch remote images for HTML data-URIs and Word embedding. */
export async function embedImageUrls(
  urls: string[],
  opts: { baseUrl: string; auth?: DozukiAuth; fetchFn?: typeof fetch },
): Promise<FetchedImages> {
  const uris: EmbeddedImages = new Map();
  const bytes = new Map<string, Buffer>();
  const mime = new Map<string, string>();
  const fetchFn = opts.fetchFn ?? fetch;
  const headers = authHeaders(opts.auth);

  await Promise.all(
    [...new Set(urls)].map(async (raw) => {
      const resolved = resolveAssetUrl(raw, opts.baseUrl);
      if (!resolved) return;
      try {
        const res = await fetchFn(resolved, { headers });
        if (!res.ok) return;
        const buf = Buffer.from(await res.arrayBuffer());
        const mt = guessMime(resolved, res.headers.get("content-type"));
        uris.set(raw, `data:${mt};base64,${buf.toString("base64")}`);
        bytes.set(raw, buf);
        mime.set(raw, mt);
      } catch {
        /* skip failed images */
      }
    }),
  );

  return { uris, bytes, mime };
}

export function imgSrc(url: string, embedded: EmbeddedImages, baseUrl: string): string {
  return embedded.get(url) ?? resolveAssetUrl(url, baseUrl);
}
