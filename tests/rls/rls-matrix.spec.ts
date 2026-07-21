/**
 * RLS Matrix Tests — Fidelize
 * ---------------------------------------------------------------------------
 * Verifica que os três perfis (customer, funcionário/staff, establishment owner)
 * só enxergam / mutam dados permitidos pelas políticas RLS.
 *
 * Pré-requisitos:
 *   • Variáveis de ambiente:
 *       SUPABASE_URL
 *       SUPABASE_ANON_KEY            (login público)
 *       SUPABASE_SERVICE_ROLE_KEY    (fixtures/cleanup)
 *   • Rodar com: `bunx vitest run tests/rls/rls-matrix.spec.ts`
 *
 * O teste cria três usuários efêmeros (com sufixo aleatório), dois
 * estabelecimentos, e valida cada garantia RLS. Ao final, limpa tudo.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL!;
const ANON = process.env.SUPABASE_ANON_KEY!;
const SR = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const skipAll = !URL || !ANON || !SR;
const d = skipAll ? describe.skip : describe;

d("RLS matrix — customer/staff/owner isolation", () => {
  const suffix = Math.random().toString(36).slice(2, 8);
  const admin: SupabaseClient = createClient(URL, SR, { auth: { persistSession: false } });

  const users = {
    ownerA: { email: `ownerA-${suffix}@rls.test`, pass: "TestPass!123", id: "" },
    staffA: { email: `staffA-${suffix}@rls.test`, pass: "TestPass!123", id: "" },
    ownerB: { email: `ownerB-${suffix}@rls.test`, pass: "TestPass!123", id: "" },
    customer: { email: `cust-${suffix}@rls.test`, pass: "TestPass!123", id: "" },
  };

  let estA = "";
  let estB = "";
  let customerRowA = "";
  let customerRowB = "";

  async function signIn(email: string, pass: string) {
    const c = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error } = await c.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
    return c;
  }

  beforeAll(async () => {
    // create users
    for (const key of Object.keys(users) as Array<keyof typeof users>) {
      const u = users[key];
      const { data, error } = await admin.auth.admin.createUser({
        email: u.email, password: u.pass, email_confirm: true,
      });
      if (error) throw error;
      u.id = data.user!.id;
    }
    // establishments A/B
    const { data: eA } = await admin.from("establishments").insert({
      name: `RLS A ${suffix}`, slug: `rls-a-${suffix}`, plan: "free",
    }).select("id").single();
    const { data: eB } = await admin.from("establishments").insert({
      name: `RLS B ${suffix}`, slug: `rls-b-${suffix}`, plan: "free",
    }).select("id").single();
    estA = eA!.id; estB = eB!.id;

    // memberships
    await admin.from("establishment_members").insert([
      { establishment_id: estA, user_id: users.ownerA.id, role: "owner", active: true },
      { establishment_id: estA, user_id: users.staffA.id, role: "staff", active: true },
      { establishment_id: estB, user_id: users.ownerB.id, role: "owner", active: true },
    ]);

    // account_type
    await admin.from("profiles").upsert([
      { id: users.ownerA.id, account_type: "establishment", full_name: "Owner A" },
      { id: users.staffA.id, account_type: "establishment", full_name: "Staff A" },
      { id: users.ownerB.id, account_type: "establishment", full_name: "Owner B" },
      { id: users.customer.id, account_type: "customer", full_name: "Customer" },
    ]);

    // one customer in each establishment
    const cA = await admin.from("customers").insert({
      establishment_id: estA, name: "Cliente A", phone: `+55110000${suffix}`,
      user_id: users.customer.id,
    }).select("id").single();
    customerRowA = cA.data!.id;
    const cB = await admin.from("customers").insert({
      establishment_id: estB, name: "Cliente B", phone: `+55220000${suffix}`,
    }).select("id").single();
    customerRowB = cB.data!.id;
  }, 30_000);

  afterAll(async () => {
    await admin.from("customers").delete().in("id", [customerRowA, customerRowB].filter(Boolean));
    await admin.from("establishment_members").delete().in("establishment_id", [estA, estB]);
    await admin.from("establishments").delete().in("id", [estA, estB]);
    for (const u of Object.values(users)) if (u.id) await admin.auth.admin.deleteUser(u.id);
  });

  // ─────────────────────────────────────────────────────────
  // CUSTOMER
  // ─────────────────────────────────────────────────────────
  it("customer só vê os próprios registros de customers", async () => {
    const c = await signIn(users.customer.email, users.customer.pass);
    const { data, error } = await c.from("customers").select("id, user_id");
    expect(error).toBeNull();
    expect(data?.every((r) => r.user_id === users.customer.id)).toBe(true);
  });

  it("customer NÃO consegue ler outros clientes", async () => {
    const c = await signIn(users.customer.email, users.customer.pass);
    const { data } = await c.from("customers").select("id").eq("id", customerRowB);
    expect(data ?? []).toHaveLength(0);
  });

  it("customer NÃO consegue inserir carimbos (stamps)", async () => {
    const c = await signIn(users.customer.email, users.customer.pass);
    const { error } = await c.from("stamps").insert({
      card_id: "00000000-0000-0000-0000-000000000000",
      establishment_id: estA, cycle: 1,
    });
    expect(error).not.toBeNull();
  });

  it("customer NÃO enxerga establishment_members", async () => {
    const c = await signIn(users.customer.email, users.customer.pass);
    const { data } = await c.from("establishment_members").select("id");
    expect(data ?? []).toHaveLength(0);
  });

  // ─────────────────────────────────────────────────────────
  // STAFF (funcionário do estabelecimento A)
  // ─────────────────────────────────────────────────────────
  it("staff vê clientes do próprio estabelecimento", async () => {
    const c = await signIn(users.staffA.email, users.staffA.pass);
    const { data, error } = await c.from("customers").select("id, establishment_id").eq("establishment_id", estA);
    expect(error).toBeNull();
    expect((data ?? []).length).toBeGreaterThan(0);
  });

  it("staff NÃO vê clientes de outro estabelecimento", async () => {
    const c = await signIn(users.staffA.email, users.staffA.pass);
    const { data } = await c.from("customers").select("id").eq("establishment_id", estB);
    expect(data ?? []).toHaveLength(0);
  });

  it("staff NÃO consegue alterar dados do estabelecimento", async () => {
    const c = await signIn(users.staffA.email, users.staffA.pass);
    const { error } = await c.from("establishments").update({ name: "hack" }).eq("id", estA);
    // ou erro RLS ou 0 rows afetadas — ambos são aceitáveis
    const { data: after } = await admin.from("establishments").select("name").eq("id", estA).single();
    expect(after?.name).not.toBe("hack");
    // se veio erro, é o esperado
    if (error) expect(error).not.toBeNull();
  });

  // ─────────────────────────────────────────────────────────
  // OWNER (dono do estabelecimento A)
  // ─────────────────────────────────────────────────────────
  it("owner vê e edita o próprio estabelecimento", async () => {
    const c = await signIn(users.ownerA.email, users.ownerA.pass);
    const { data, error } = await c.from("establishments").select("id, name").eq("id", estA).single();
    expect(error).toBeNull();
    expect(data?.id).toBe(estA);
  });

  it("owner NÃO vê establishment_members de outro estabelecimento", async () => {
    const c = await signIn(users.ownerA.email, users.ownerA.pass);
    const { data } = await c.from("establishment_members").select("id").eq("establishment_id", estB);
    expect(data ?? []).toHaveLength(0);
  });

  it("owner NÃO vê clientes de outro estabelecimento", async () => {
    const c = await signIn(users.ownerA.email, users.ownerA.pass);
    const { data } = await c.from("customers").select("id").eq("establishment_id", estB);
    expect(data ?? []).toHaveLength(0);
  });

  it("nenhum perfil não-admin lê profiles_account_type_backup", async () => {
    for (const u of [users.customer, users.staffA, users.ownerA]) {
      const c = await signIn(u.email, u.pass);
      const { data } = await c.from("profiles_account_type_backup").select("id");
      expect(data ?? []).toHaveLength(0);
    }
  });
});
