import { describe, it, expect } from "vitest";
import { hasFeature } from "../plans.functions";

// Mocking the supabase client to simulate RPC and table lookups
const mockSupabase = (planFeatureStrict: boolean, overrideExists: boolean) => ({
  rpc: async (name: string, args: any) => {
    if (name === "has_plan_feature_strict") return { data: planFeatureStrict, error: null };
    if (name === "has_plan_feature") {
      // Logic inside the real RPC has_plan_feature: has_plan_feature_strict OR override_exists
      return { data: planFeatureStrict || overrideExists, error: null };
    }
    return { data: null, error: null };
  }
});

describe("Feature Overrides Audit Test Suite", () => {
  const estId = "00000000-0000-0000-0000-000000000001";
  const feature = "digital_menu";

  it("Scenario 1: Plano possui feature -> permitido", async () => {
    const supabase = mockSupabase(true, false);
    const ok = await hasFeature(supabase, estId, feature);
    expect(ok).toBe(true);
  });

  it("Scenario 2: Plano não possui + sem override -> bloqueado", async () => {
    const supabase = mockSupabase(false, false);
    const ok = await hasFeature(supabase, estId, feature);
    expect(ok).toBe(false);
  });

  it("Scenario 3: Plano não possui + override ativo -> permitido", async () => {
    const supabase = mockSupabase(false, true);
    const ok = await hasFeature(supabase, estId, feature);
    expect(ok).toBe(true);
  });

  it("Scenario 4: Revogação volta a bloquear (simulado)", async () => {
    // Primeiro com override
    const supabaseWith = mockSupabase(false, true);
    expect(await hasFeature(supabaseWith, estId, feature)).toBe(true);
    
    // Depois sem override
    const supabaseWithout = mockSupabase(false, false);
    expect(await hasFeature(supabaseWithout, estId, feature)).toBe(false);
  });
});
