import { test, expect } from "@playwright/test";

/**
 * Cenários de validação do vínculo do cliente a um estabelecimento via QR
 * (rota pública `/l/:slug`) — cobre os dois fluxos exigidos pelo produto:
 *
 *  1. **Deslogado** — visitante escaneia o QR de outra empresa. A página
 *     pública deve renderizar o formulário e o CTA "Já tenho conta
 *     Fidelize" (que leva ao `/auth` com `est_slug=<slug>` preservado).
 *
 *  2. **Logado como cliente** — ao abrir `/l/:slug`, o `beforeLoad` deve
 *     chamar `attachEstablishmentBySlug`, gravar o audit log e redirecionar
 *     para `/carteira/:slug` com um toast contextual dizendo qual foi o
 *     status: **created**, **adopted** (cadastro antigo reaproveitado) ou
 *     **existing** (nada mudou — evita duplicata).
 *
 *  3. **Estabelecimento inativo** — o servidor lança `AttachEstablishmentError`
 *     com `code=inactive`; o cliente vê um toast amigável em `/carteira`
 *     em vez de uma tela de erro genérica.
 *
 * ⚙️ Parametrização por env (pula sem quebrar CI local):
 *
 *   E2E_SLUG_ACTIVE     — slug de um estabelecimento ativo com campanha
 *   E2E_SLUG_INACTIVE   — slug de um estabelecimento inativo/suspenso
 *
 *   LOVABLE_BROWSER_SUPABASE_SESSION_JSON — session de um customer
 *   LOVABLE_BROWSER_SUPABASE_STORAGE_KEY  — chave localStorage do supabase-js
 */

const SLUG_ACTIVE = process.env.E2E_SLUG_ACTIVE;
const SLUG_INACTIVE = process.env.E2E_SLUG_INACTIVE;
const SESSION_JSON = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const STORAGE_KEY = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;

test.describe("Vínculo de cliente via QR (l/:slug)", () => {
  test("deslogado: mostra formulário público e CTA 'Já tenho conta'", async ({ page, context }) => {
    test.skip(!SLUG_ACTIVE, "defina E2E_SLUG_ACTIVE para rodar este cenário");
    // Garante sessão limpa.
    await context.clearCookies();
    await page.goto(`/l/${SLUG_ACTIVE}`);
    await expect(page.getByRole("button", { name: /quero meu cartão/i })).toBeVisible();
    const cta = page.getByRole("link", { name: /já tenho conta fidelize/i });
    await expect(cta).toBeVisible();
    // O CTA precisa preservar o slug para o auto-attach após o login.
    const href = await cta.getAttribute("href");
    expect(href).toContain(`est_slug=${SLUG_ACTIVE}`);
  });

  test("logado: escaneia QR de outra empresa → redireciona para /carteira/:slug sem duplicar", async ({ page }) => {
    test.skip(
      !SLUG_ACTIVE || !SESSION_JSON || !STORAGE_KEY,
      "defina E2E_SLUG_ACTIVE + session de customer para rodar",
    );
    // Injeta sessão de cliente autenticado.
    await page.goto("/");
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [STORAGE_KEY!, SESSION_JSON!],
    );

    // 1ª visita: cria ou adota o cartão.
    await page.goto(`/l/${SLUG_ACTIVE}`);
    await expect(page).toHaveURL(new RegExp(`/carteira/${SLUG_ACTIVE}$`));

    // 2ª visita: idempotência — status deve ser "existing", sem criar duplicata.
    await page.goto(`/l/${SLUG_ACTIVE}`);
    await expect(page).toHaveURL(new RegExp(`/carteira/${SLUG_ACTIVE}$`));
    // O toast reflete que nada mudou no cadastro anterior.
    await expect(page.getByText(/já tinha cartão|nada mudou/i)).toBeVisible({ timeout: 5000 });
  });

  test("logado: estabelecimento inativo mostra toast amigável em /carteira", async ({ page }) => {
    test.skip(
      !SLUG_INACTIVE || !SESSION_JSON || !STORAGE_KEY,
      "defina E2E_SLUG_INACTIVE + session de customer para rodar",
    );
    await page.goto("/");
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [STORAGE_KEY!, SESSION_JSON!],
    );

    await page.goto(`/l/${SLUG_INACTIVE}`);
    await expect(page).toHaveURL(/\/carteira(\/|$)/);
    await expect(page.getByText(/indisponível|temporariamente/i)).toBeVisible({ timeout: 5000 });
  });
});
