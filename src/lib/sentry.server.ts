// Server-side Sentry capture. Uses the browser SDK's transport in Workers
// (it is fetch-based) and only activates when SENTRY_DSN is configured.
// We intentionally avoid @sentry/node / @sentry/cloudflare here because the
// TanStack Start template bundles a single Worker output and we want zero
// runtime cost when the DSN is missing.
import * as Sentry from "@sentry/react";

let initialized = false;

function ensureInit() {
  if (initialized) return !!Sentry.getClient();
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 0,
    defaultIntegrations: false,
  });
  initialized = true;
  return true;
}

export function captureServerError(error: unknown, context: Record<string, unknown> = {}) {
  try {
    if (!ensureInit()) return;
    Sentry.captureException(error, { extra: { runtime: "server", ...context } });
    // Best-effort: flush before the Worker isolate is torn down.
    void Sentry.flush(1500).catch(() => {});
  } catch {
    // never let telemetry crash the request
  }
}
