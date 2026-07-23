import { test, expect, type Page } from "@playwright/test";

/**
 * E2E — nomes automáticos de designs no editor de QR.
 *
 * A regra de produção vive em `buildDefaultDesignName` (src/lib/qr-design-name.ts),
 * usado pelo editor `/app/avaliacoes/qr`. Como esse editor exige autenticação de
 * lojista, este teste roda contra um harness público que consome o MESMO helper
 * (`/dev/qr-design-name`), garantindo cobertura de UI sem depender de sessão.
 */

const CHROMIUM_EXECUTABLE =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  "/nix/store/2zqa6kavc8znbgrac1l3pix9lwr3w5nj-playwright-chromium/chrome-linux/chrome";

test.use({
  launchOptions: {
    executablePath: CHROMIUM_EXECUTABLE,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

const CASES: Array<{ dest: "reviews" | "landing" | "linktree"; label: string }> = [
  { dest: "reviews", label: "Avaliação" },
  { dest: "landing", label: "Cartão Fidelidade" },
  { dest: "linktree", label: "Árvore de Links" },
];

async function saveTwice(page: Page, dest: string, label: string) {
  await page.locator('[data-testid="dest-select"]').selectOption(dest);
  await expect(page.locator('[data-testid="next-name"]')).toHaveText(`${label} 1`);
  await page.locator('[data-testid="save-design"]').click();
  // Aguarda a hidratação: o clique só atualiza a UI depois que o React monta.
  await expect(page.locator('[data-testid="next-name"]')).toHaveText(`${label} 2`, {
    timeout: 15_000,
  });
  await page.locator('[data-testid="save-design"]').click();
}

test.describe("QR editor — nomes automáticos de designs salvos", () => {
  for (const { dest, label } of CASES) {
    test(`destino ${dest} salva como "${label} 1" e "${label} 2"`, async ({ page }) => {
      await page.goto("/dev/qr-design-name");
      await page.waitForLoadState("networkidle");
      await saveTwice(page, dest, label);

      const items = page.locator(`[data-testid="design-item"][data-dest="${dest}"]`);
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toHaveText(`${label} 1`);
      await expect(items.nth(1)).toHaveText(`${label} 2`);
    });
  }

  test("cada destino numera de forma independente", async ({ page }) => {
    await page.goto("/dev/qr-design-name");
    for (const { dest, label } of CASES) {
      await saveTwice(page, dest, label);
    }
    // Cada destino deve ter exatamente 2 designs numerados 1 e 2.
    for (const { dest, label } of CASES) {
      const items = page.locator(`[data-testid="design-item"][data-dest="${dest}"]`);
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toHaveText(`${label} 1`);
      await expect(items.nth(1)).toHaveText(`${label} 2`);
    }
  });
});
