import { getRequest } from "@tanstack/react-start/server";

/** Hosts allowed to call server functions in addition to the request host. */
const EXTRA_ALLOWED_HOSTS = new Set<string>(
  [process.env.PUBLIC_APP_URL, process.env.PUBLISHED_APP_URL]
    .filter(Boolean)
    .map((u) => {
      try {
        return new URL(u as string).host;
      } catch {
        return "";
      }
    })
    .filter(Boolean),
);

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * Same-origin check for state-changing server function calls.
 * Returns an error message when the request must be rejected, otherwise null.
 */
export function checkSameOrigin(): string | null {
  let request: Request;
  try {
    request = getRequest();
  } catch {
    // No HTTP context (build/prerender) — nothing to protect.
    return null;
  }
  if (!request) return null;

  const method = (request.method || "GET").toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return null;

  const headers = request.headers;
  const secFetchSite = headers.get("sec-fetch-site");
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return "Cross-site request blocked";
  }

  const selfHost = hostOf(request.url) ?? headers.get("host");
  const originHost = hostOf(headers.get("origin")) ?? hostOf(headers.get("referer"));

  // Non-browser callers (no Origin/Referer, no Sec-Fetch-Site) are left to
  // the auth middleware; browsers always send Origin on cross-site writes.
  if (!originHost) return null;

  if (originHost === selfHost) return null;
  if (EXTRA_ALLOWED_HOSTS.has(originHost)) return null;

  return "Cross-site request blocked";
}
