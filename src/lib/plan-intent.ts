/**
 * Intenção de plano — guarda o plano escolhido na landing para abrir o checkout
 * correto depois do cadastro/onboarding.
 */
const KEY = "fidelize:plan-intent";
const TTL_MS = 24 * 60 * 60 * 1000;

export function setPlanIntent(slug: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ slug, at: Date.now() }));
  } catch {}
}

export function getPlanIntent(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { slug?: string; at?: number };
    if (!parsed?.slug || !parsed.at || Date.now() - parsed.at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return parsed.slug;
  } catch {
    return null;
  }
}

export function clearPlanIntent() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
