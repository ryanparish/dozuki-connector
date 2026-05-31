import type { Request } from "express";
import type { DozukiAuth } from "./types.js";

/** Per-request auth: UI headers override env defaults. */
export function resolveAuth(
  req: Request,
  defaultAuth?: DozukiAuth,
): DozukiAuth | undefined {
  const apiKey = req.get("X-Dozuki-Api-Key")?.trim();
  if (apiKey) {
    const appId = req.get("X-Dozuki-App-Id")?.trim();
    return { kind: "api-header", apiKey, appId: appId || undefined };
  }
  return defaultAuth;
}

export function resolveBaseUrl(req: Request, defaultBaseUrl: string): string {
  const fromHeader = req.get("X-Dozuki-Base-Url")?.trim();
  return fromHeader || defaultBaseUrl;
}
