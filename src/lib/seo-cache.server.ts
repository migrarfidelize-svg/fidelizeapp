/**
 * SEO/OpenGraph cache helpers.
 *
 * Uses createIsomorphicFn so the client bundle contains only no-op stubs
 * (satisfying import-protection) while SSR receives the real h3 header helpers.
 */
import { createIsomorphicFn } from "@tanstack/react-start";

export type SeoCacheOptions = {
  sMaxAge?: number;
  staleWhileRevalidate?: number;
  version: Array<string | number | Date | null | undefined>;
};

function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

const setHeader = createIsomorphicFn()
  .client((_name: string, _value: string) => {})
  .server((name: string, value: string) => {
    const { setResponseHeader } = require("@tanstack/react-start/server");
    setResponseHeader(name, value);
  });

const getHeader = createIsomorphicFn()
  .client((_name: string): string | undefined => undefined)
  .server((name: string): string | undefined => {
    const { getRequestHeader } = require("@tanstack/react-start/server");
    return getRequestHeader(name);
  });

const setStatus = createIsomorphicFn()
  .client((_code: number) => {})
  .server((code: number) => {
    const { setResponseStatus } = require("@tanstack/react-start/server");
    setResponseStatus(code);
  });

export function applySeoCacheHeaders(opts: SeoCacheOptions): boolean {
  if (typeof window !== "undefined") return false;
  const sMaxAge = opts.sMaxAge ?? 300;
  const swr = opts.staleWhileRevalidate ?? 86400;

  const versionKey = opts.version
    .map((v) => {
      if (v == null) return "";
      if (v instanceof Date) return String(v.getTime());
      return String(v);
    })
    .join("|");

  const etag = `W/"seo-${hash(versionKey)}"`;

  try {
    setHeader(
      "Cache-Control",
      `public, max-age=0, must-revalidate, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
    );
    setHeader("ETag", etag);
    setHeader("Vary", "Accept-Encoding");
  } catch {
    return false;
  }

  try {
    const inm = getHeader("if-none-match");
    if (inm && inm === etag) {
      setStatus(304);
      return true;
    }
  } catch {}

  return false;
}
