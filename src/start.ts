import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { captureServerError } from "./lib/sentry.server";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "SAMEORIGIN",
  "referrer-policy": "strict-origin-when-cross-origin",
  "strict-transport-security": "max-age=63072000; includeSubDomains; preload",
  "permissions-policy": "camera=(self), microphone=(), geolocation=(), payment=()",
  "cross-origin-opener-policy": "same-origin",
};

function applySecurityHeaders(res: Response): Response {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    if (!res.headers.has(k)) res.headers.set(k, v);
  }
  return res;
}

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const res = await next();
    if (res instanceof Response) applySecurityHeaders(res);
    return res;
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    captureServerError(error, { middleware: "request" });
    console.error(error);
    return applySecurityHeaders(new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    }));
  }
});

const csrfMiddleware = createMiddleware({ type: "function" }).server(async ({ next }) => {
  const { checkSameOrigin } = await import("./lib/csrf.server");
  const blocked = checkSameOrigin();
  if (blocked) {
    throw new Response(blocked, { status: 403 });
  }
  return next();
});

const serverFnErrorCapture = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    captureServerError(error, { middleware: "serverFn" });
    throw error;
  }
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth, csrfMiddleware, serverFnErrorCapture],
  requestMiddleware: [errorMiddleware],
}));

