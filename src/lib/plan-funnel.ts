/**
 * Analytics do funil de planos.
 * Registra o plano escolhido na landing e o plano que efetivamente abriu no
 * checkout, para detectar divergências rapidamente em /hash.
 */
const SESSION_KEY = "fidelize:funnel-session";
const LAST_SELECT_KEY = "fidelize:funnel-last-plan";

export type PlanFunnelStage = "landing_select" | "auth_intent" | "checkout_open" | "checkout_mismatch";

export function funnelSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = (crypto.randomUUID?.() ?? String(Date.now() + Math.random())).slice(0, 64);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

type Payload = {
  stage: PlanFunnelStage;
  plan_slug?: string | null;
  plan_name?: string | null;
  amount?: number | null;
  source?: string | null;
  provider?: string | null;
  meta?: Record<string, string | number | boolean | null>;
};

export function trackPlanFunnel(payload: Payload): void {
  if (typeof window === "undefined") return;
  try {
    const body = JSON.stringify({ ...payload, session_id: funnelSessionId() });
    const url = "/api/public/t/plan";
    if (typeof navigator?.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      if (navigator.sendBeacon(url, blob)) return;
    }
    void fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
      credentials: "omit",
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Guarda o plano escolhido na landing para comparar depois com o checkout. */
export function rememberSelectedPlan(slug: string, name?: string, amount?: number) {
  try {
    localStorage.setItem(LAST_SELECT_KEY, JSON.stringify({ slug, name: name ?? null, amount: amount ?? null }));
  } catch {}
}

export function readSelectedPlan(): { slug: string; name: string | null; amount: number | null } | null {
  try {
    const raw = localStorage.getItem(LAST_SELECT_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as { slug?: string; name?: string | null; amount?: number | null };
    return p?.slug ? { slug: p.slug, name: p.name ?? null, amount: p.amount ?? null } : null;
  } catch {
    return null;
  }
}

/**
 * Registra a abertura do checkout e, se o plano diferir do escolhido na landing,
 * dispara também um evento de divergência.
 */
export function trackCheckoutOpen(args: {
  slug: string;
  name: string;
  amount: number;
  source?: string;
}) {
  const expected = readSelectedPlan();
  trackPlanFunnel({
    stage: "checkout_open",
    plan_slug: args.slug,
    plan_name: args.name,
    amount: args.amount,
    source: args.source ?? "app_planos",
    meta: expected ? { expected_slug: expected.slug, expected_amount: expected.amount } : {},
  });
  if (expected && expected.slug !== args.slug) {
    trackPlanFunnel({
      stage: "checkout_mismatch",
      plan_slug: args.slug,
      plan_name: args.name,
      amount: args.amount,
      source: args.source ?? "app_planos",
      meta: { expected_slug: expected.slug, expected_amount: expected.amount, opened_slug: args.slug },
    });
  }
}
