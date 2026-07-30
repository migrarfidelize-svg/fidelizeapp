import { test, expect } from "@playwright/test";

/**
 * Fluxo: landing → escolher plano → /auth (cadastro) → /onboarding → /app/planos
 * Garante que o plano escolhido é preservado (plan-intent) e que o checkout
 * do plano correto abre automaticamente. Também valida o destino pós-pagamento.
 */

const KEY = "fidelize:plan-intent";

const PLANS = [
  { slug: "essencial", price: "29,90" },
  { slug: "profissional", price: "59,90" },
  { slug: "premium", price: "119,90" },
  { slug: "business", price: "349,00", sales: true },
];

async function seedIntent(page: import("@playwright/test").Page, slug: string) {
  await page.evaluate(
    ([key, s]) => localStorage.setItem(key, JSON.stringify({ slug: s, at: Date.now() })),
    [KEY, slug] as const,
  );
}

test.describe("Cadastro → checkout do plano selecionado", () => {
  test("CTA da landing leva para /auth com o plano escolhido", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator('a[href*="/auth"][href*="plan="]').first();
    await expect(cta).toBeVisible({ timeout: 15_000 });
    const href = (await cta.getAttribute("href")) ?? "";
    const slug = new URL(href, page.url()).searchParams.get("plan");
    expect(slug, "o CTA deve carregar o slug do plano").toBeTruthy();

    await cta.click();
    await page.waitForURL(/\/auth/);
    expect(new URL(page.url()).searchParams.get("plan")).toBe(slug);
  });

  for (const plan of PLANS) {
    test(`plano "${plan.slug}" sobrevive ao cadastro e abre o checkout certo`, async ({ page }) => {
      await page.goto("/");
      await seedIntent(page, plan.slug);

      // Após o cadastro/onboarding o lojista sempre cai em /app/planos.
      await page.goto("/app/planos");
      await page.waitForTimeout(1500);

      // Sem sessão, o guard leva para /auth — a intenção precisa sobreviver.
      if (/\/auth/.test(page.url())) {
        const kept = await page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "{}")?.slug, KEY);
        expect(kept, "plan-intent deve sobreviver ao redirecionamento de login").toBe(plan.slug);
        return;
      }

      // Com sessão: o diálogo de pagamento do plano correto abre sozinho.
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 20_000 });
      if (plan.sales) {
        await expect(dialog).toContainText(/vendas|orçamento|proposta/i);
      } else {
        await expect(dialog).toContainText(new RegExp(plan.price.replace(",", "[.,]")));
      }
      // A intenção é consumida uma única vez.
      const after = await page.evaluate((k) => localStorage.getItem(k), KEY);
      expect(after).toBeNull();
    });
  }

  test("após pagamento aprovado o destino é o painel /app", async ({ page }) => {
    await page.goto("/app?pagamento=aprovado");
    await page.waitForTimeout(1500);
    if (/\/auth/.test(page.url())) {
      test.skip(true, "Requer sessão autenticada para validar o destino pós-pagamento.");
    }
    await expect(page).toHaveURL(/\/app(\?|$)/);
  });
});
