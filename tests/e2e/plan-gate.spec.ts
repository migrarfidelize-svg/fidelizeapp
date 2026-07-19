import { test, expect } from "@playwright/test";

/**
 * End-to-end coverage for the `public_reviews` plan gate.
 *
 * Cobre as duas superfícies observáveis do gate:
 *
 *  1. Página pública `/avaliar/:slug` — quando o plano do estabelecimento
 *     habilita `public_reviews`, a página deve renderizar o formulário de
 *     avaliação; quando desabilita, deve exibir uma mensagem amigável de
 *     recurso indisponível (fail-closed).
 *
 *  2. Gerador de QR em `/app/qrcodes` (autenticado) — quando `useMyFeature`
 *     retorna `allowed=false`, o botão de "Baixar QR de avaliação" mostra
 *     o CTA de upgrade em vez do link `/avaliar/:slug`; quando `allowed=true`,
 *     mostra o link direto.
 *
 * ⚙️ Parametrização por env (permite rodar sem seed manual):
 *
 *   E2E_SLUG_REVIEWS_ENABLED   — slug de estabelecimento em plano Pro/Enterprise
 *   E2E_SLUG_REVIEWS_DISABLED  — slug de estabelecimento em plano Free/Starter
 *
 *   LOVABLE_BROWSER_SUPABASE_SESSION_JSON   — session de merchant autenticado
 *   LOVABLE_BROWSER_SUPABASE_STORAGE_KEY    — chave que o cliente supabase-js lê
 *   E2E_EXPECT_REVIEWS_ALLOWED              — "true" | "false" para o cenário
 *
 * Testes sem env correspondente são pulados (não quebram CI local).
 */

const SLUG_ENABLED = process.env.E2E_SLUG_REVIEWS_ENABLED;
const SLUG_DISABLED = process.env.E2E_SLUG_REVIEWS_DISABLED;
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const EXPECT_ALLOWED = process.env.E2E_EXPECT_REVIEWS_ALLOWED === "true";

test.describe("Public review page — plan gate", () => {
  test("liberado (Pro/Enterprise): renderiza formulário público", async ({ page }) => {
    test.skip(!SLUG_ENABLED, "defina E2E_SLUG_REVIEWS_ENABLED com um slug em plano Pro/Enterprise");
    await page.goto(`/avaliar/${SLUG_ENABLED}`);
    // Ao carregar, a página válida mostra o nome do estabelecimento e um form,
    // ou um estado neutro de "envie sua avaliação".
    await expect(
      page.locator("form, [data-testid=review-form], text=/avaliação|avalie|obrigado/i").first(),
    ).toBeVisible({ timeout: 10_000 });
    // NÃO deve exibir mensagem de recurso indisponível.
    await expect(page.locator("text=/indispon[íi]vel|n[aã]o est[aá] dispon[íi]vel|upgrade/i")).toHaveCount(0);
  });

  test("bloqueado (Free/Starter): exibe mensagem de recurso indisponível", async ({ page }) => {
    test.skip(!SLUG_DISABLED, "defina E2E_SLUG_REVIEWS_DISABLED com um slug em plano Free/Starter");
    const resp = await page.goto(`/avaliar/${SLUG_DISABLED}`);
    // O gate é fail-closed: ou 404-like, ou uma mensagem clara. Aceitamos ambos.
    if (resp && resp.status() >= 400 && resp.status() !== 404) {
      // status 5xx é uma quebra real, não gate esperado
      throw new Error(`Unexpected status ${resp.status()} on gated page`);
    }
    // Alguma pista visível ao usuário: "indisponível", "não habilitado" ou 404.
    const bloqueio = page.locator(
      "text=/indispon[íi]vel|n[aã]o est[aá] dispon[íi]vel|n[aã]o encontrad|404|upgrade/i",
    );
    await expect(bloqueio.first()).toBeVisible({ timeout: 10_000 });
    // E o formulário público NÃO deve estar renderizado.
    await expect(page.locator("form textarea, form [name='rating']")).toHaveCount(0);
  });
});

test.describe("QR generator — plan gate (merchant autenticado)", () => {
  test.beforeEach(async ({ context, page }) => {
    test.skip(
      !SESSION_JSON || !STORAGE_KEY,
      "defina LOVABLE_BROWSER_SUPABASE_SESSION_JSON e _STORAGE_KEY para testar com sessão real",
    );
    // Restaura a sessão do merchant antes de qualquer navegação privada.
    await page.goto("/");
    await page.evaluate(
      ([key, value]) => {
        window.localStorage.setItem(key as string, value as string);
      },
      [STORAGE_KEY!, SESSION_JSON!],
    );
  });

  test("QR de avaliação segue o plano do merchant logado", async ({ page }) => {
    await page.goto("/app/qrcodes");
    // A página autenticada carrega com skeletons/loaders; aguardamos
    // qualquer marca do gate aparecer.
    await page.waitForLoadState("networkidle");

    if (EXPECT_ALLOWED) {
      // Plano Pro/Enterprise: deve haver o link /avaliar/<slug>
      await expect(page.locator("text=/\\/avaliar\\//").first()).toBeVisible({ timeout: 10_000 });
      // E não deve exibir o CTA de upgrade.
      await expect(page.locator("text=/Faça upgrade/i")).toHaveCount(0);
    } else {
      // Plano Free/Starter: deve exibir CTA de upgrade em vez do link
      const upgrade = page.locator("text=/Faça upgrade|upgrade em Planos/i").first();
      await expect(upgrade).toBeVisible({ timeout: 10_000 });
      // O link direto /avaliar/ não deve estar presente
      await expect(page.locator("a[href^='/avaliar/']")).toHaveCount(0);
    }
  });
});

test.describe("Gate — resiliência básica sem sessão", () => {
  test("visitar /app/qrcodes sem sessão redireciona para /auth", async ({ page }) => {
    const resp = await page.goto("/app/qrcodes");
    // Após o guard do _authenticated, esperamos aterrissar em /auth (login).
    await page.waitForURL(/\/auth(\b|\/)/, { timeout: 10_000 }).catch(() => undefined);
    expect(page.url()).toMatch(/\/auth/);
    // Também garante que não vazamos o dashboard privado.
    expect(resp?.status() ?? 200).toBeLessThan(500);
  });
});
