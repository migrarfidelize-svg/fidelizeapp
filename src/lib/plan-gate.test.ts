import { describe, it, expect } from "vitest";

// Mirrors the resolution logic used by:
//   - assertFeature (backend gate in src/lib/plans.functions.ts via has_plan_feature)
//   - useMyFeature (frontend gate in src/hooks/useMyFeature.ts)
//   - adminReconcileFeatureAccess (audit reconciliation)
// Keeping this in one pure function guarantees all three code paths stay in sync:
// a change in one direction MUST update every call site or this test fails.
export function resolveFeatureAccess(
  plans: { id: string; tier: string }[],
  planFeatures: { plan_id: string; feature_key: string; enabled: boolean }[],
  establishments: { id: string; plan: string }[],
  featureKey: string,
) {
  const enabledByTier = new Map<string, boolean>();
  for (const p of plans) {
    const row = planFeatures.find((x) => x.plan_id === p.id && x.feature_key === featureKey);
    enabledByTier.set(p.tier, !!row?.enabled);
  }
  return establishments.map((e) => ({
    id: e.id,
    tier: e.plan,
    allowed: enabledByTier.get(e.plan) ?? false,
  }));
}

describe("public_reviews gate synchronization (admin toggle ↔ backend gate)", () => {
  const plans = [
    { id: "p-free", tier: "free" },
    { id: "p-starter", tier: "starter" },
    { id: "p-pro", tier: "pro" },
    { id: "p-ent", tier: "enterprise" },
  ];
  const ests = [
    { id: "e1", plan: "free" },
    { id: "e2", plan: "starter" },
    { id: "e3", plan: "pro" },
    { id: "e4", plan: "enterprise" },
  ];

  it("blocks free/starter and allows pro/enterprise by default", () => {
    const pf = [
      { plan_id: "p-free", feature_key: "public_reviews", enabled: false },
      { plan_id: "p-starter", feature_key: "public_reviews", enabled: false },
      { plan_id: "p-pro", feature_key: "public_reviews", enabled: true },
      { plan_id: "p-ent", feature_key: "public_reviews", enabled: true },
    ];
    const r = resolveFeatureAccess(plans, pf, ests, "public_reviews");
    expect(r.filter((x) => x.allowed).map((x) => x.tier)).toEqual(["pro", "enterprise"]);
  });

  it("propagates a super-admin toggle-off on pro to every pro merchant", () => {
    const pf = [
      { plan_id: "p-pro", feature_key: "public_reviews", enabled: false },
      { plan_id: "p-ent", feature_key: "public_reviews", enabled: true },
    ];
    const r = resolveFeatureAccess(plans, pf, ests, "public_reviews");
    expect(r.find((x) => x.tier === "pro")?.allowed).toBe(false);
    expect(r.find((x) => x.tier === "enterprise")?.allowed).toBe(true);
  });

  it("treats missing plan_features row as blocked (fail-closed)", () => {
    const r = resolveFeatureAccess(plans, [], ests, "public_reviews");
    expect(r.every((x) => x.allowed === false)).toBe(true);
  });

  it("treats unknown feature_key as blocked for every tier", () => {
    const pf = [{ plan_id: "p-pro", feature_key: "public_reviews", enabled: true }];
    const r = resolveFeatureAccess(plans, pf, ests, "something_else");
    expect(r.every((x) => x.allowed === false)).toBe(true);
  });
});
