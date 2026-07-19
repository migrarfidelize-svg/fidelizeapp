// Client-side Sentry init. Activates only when VITE_SENTRY_DSN is set,
// so local/dev builds without a DSN keep working normally.
import * as Sentry from "@sentry/react";

let initialized = false;

export function initSentryClient() {
  if (initialized || typeof window === "undefined") return;
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true }),
    ],
    beforeSend(event) {
      // Drop noisy network aborts.
      const msg = event.message || event.exception?.values?.[0]?.value || "";
      if (/AbortError|NetworkError when attempting|Failed to fetch/i.test(msg)) return null;
      return event;
    },
  });
  initialized = true;
}

export function captureClientError(error: unknown, context: Record<string, unknown> = {}) {
  if (!initialized) return;
  Sentry.captureException(error, { extra: context });
}
