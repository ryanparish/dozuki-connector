import type {
  DozukiAuth,
  DozukiClientOptions,
  DozukiGuide,
  GuideDocument,
} from "./types.js";

export class DozukiClient {
  readonly baseUrl: string;
  private readonly auth?: DozukiAuth;
  private readonly fetchFn: typeof fetch;

  constructor(options: DozukiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.auth = options.auth;
    this.fetchFn = options.fetchFn ?? fetch;
  }

  private headers(): Headers {
    const h = new Headers({
      Accept: "application/json",
    });
    if (!this.auth) return h;
    if (this.auth.kind === "bearer") {
      h.set("Authorization", `Bearer ${this.auth.token}`);
    } else {
      h.set("Authorization", `api ${this.auth.apiKey}`);
      if (this.auth.appId) h.set("X-App-Id", this.auth.appId);
    }
    return h;
  }

  /** GET arbitrary API path relative to `/api/2.0` (e.g. `guides/14` or `guides/14?pretty`) */
  async getJson<T>(apiPath: string): Promise<T> {
    const url = `${this.baseUrl}/api/2.0/${apiPath.replace(/^\/+/, "")}`;
    const res = await this.fetchFn(url, { method: "GET", headers: this.headers() });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Dozuki GET ${url} failed: ${res.status} ${res.statusText} ${body}`);
    }
    return (await res.json()) as T;
  }

  async getGuide(
    guideid: number,
    query?: Record<string, string | boolean | number>,
  ): Promise<DozukiGuide> {
    const q = new URLSearchParams({ pretty: "1" });
    if (query)
      for (const [k, v] of Object.entries(query))
        q.set(k, String(v));
    return this.getJson<DozukiGuide>(`guides/${guideid}?${q.toString()}`);
  }

  /** Best-effort: some sites expose GET /documents/{id} (often requires auth). */
  async tryGetDocument(documentid: number): Promise<GuideDocument | undefined> {
    try {
      return await this.getJson<GuideDocument>(`documents/${documentid}?pretty=1`);
    } catch {
      return undefined;
    }
  }
}
