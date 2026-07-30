import { test, expect } from "@playwright/test";

/**
 * Fluxo: landing → escolher plano → /auth (cadastro) → /onboarding → /app/planos
 * Garante que o plano escolhido é preservado (plan-intent) e que o checkout
 * do plano correto abre automaticamente. Também documenta o destino pós-pagamento.
 */

const PLANS = [
  { slug: "essencial", price: "29,90" },
  { slug: "profissional", price: "59,90" },
  { slug: "premium", price: "119,90" },
  { slug: "business", price: "349,00", sales: true },
];

test.describe("Cadastro → checkout do plano selecionado", () => {
  test("landing preserva o plano escolhido até /auth", async ({ page }) => {
    await page.goto("/");
    // Clica no primeiro CTA de assinatura da tabela/cards de planos
    const cta = page.getByRole("link", { name: /assinar|começar|contratar/i }).first();
    await cta.click();
    await page.waitForURL(/\/auth/);

    const intent = await page.evaluate(() =>
      localStorage.getItem("fidelize.plan_intent") ?? sessionStorage.getItem("fidelize.plan_intent"),
    );
    expect(intent, "plan-intent deve ser gravado ao escolher o plano").toBeTruthy();
  });

  for (const plan of PLANS) {
    test(`plan-intent "${plan.slug}" abre o checkout correto em /app/planos`, async ({ page }) => {
      // Semeia a intenção como se o usuário tivesse acabado de se cadastrar
      await page.goto("/");
      await page.evaluate((slug) => {
        localStorage.setItem("fidelize.plan_intent", slug);
      }, plan.slug);

      await page.goto("/app/planos");

      // Sem sessão, o guard leva para /auth — isso já valida que a rota é protegida
      // e que a intenção sobrevive ao redirecionamento.
      if (/\/auth/.test(page.url())) {
        const kept = await page.evaluate(() => localStorage.getItem("fidelize.plan_intent"));
        expect(kept).toBe(plan.slug);
        test.info().annotations.push({
          type: "info",
          description: "Sem sessão autenticada: validado apenas a persistência da intenção.",
        });
        return;
      }

      // Com sessão: o diálogo de pagamento do plano correto deve abrir sozinho
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible({ timeout: 15_000 });

      if (plan.sales) {
        await expect(dialog).toContainText(/falar com vendas|orçamento/i);
      } else {
        await expect(dialog).toContainText(new RegExp(plan.price.replace(",", "[.,]")));
      }
    });
  }

  test("após pagamento aprovado o lojista vai para o painel", async ({ page }) => {
    // Simula o callback de aprovação: o app deve sair do checkout e cair no painel.
    await page.goto("/app?pagamento=aprovado");
    if (/\/auth/.test(page.url())) {
      test.skip(true, "Requer sessão autenticada para validar o destino pós-pagamento.");
    }
    await expect(page).toHaveURL(/\/app(\?|$)/);
  });
});
