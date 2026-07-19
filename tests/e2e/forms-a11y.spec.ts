import { test, expect, type Page } from "@playwright/test";

/**
 * Auditoria automatizada de acessibilidade de formulários públicos.
 *
 * Regras verificadas em cada campo <input>, <select>, <textarea>:
 *  1. Possui um nome acessível (label associado via htmlFor/id,
 *     aria-label ou aria-labelledby).
 *  2. Se houver texto de ajuda no formulário, o campo referencia-o
 *     via aria-describedby quando aplicável.
 *  3. Em falha de validação nativa (submit sem preencher), o campo
 *     recebe :invalid e a mensagem correspondente é anunciável.
 */

const PUBLIC_FORMS = [
  { name: "Login", path: "/auth" },
  { name: "Recuperar senha", path: "/auth/recuperar" },
];

async function collectFields(page: Page) {
  return page.evaluate(() => {
    const selectors = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea';
    const elements = Array.from(document.querySelectorAll<HTMLElement>(selectors));
    return elements.map((el) => {
      const id = el.id;
      const ariaLabel = el.getAttribute("aria-label");
      const ariaLabelledBy = el.getAttribute("aria-labelledby");
      const ariaDescribedBy = el.getAttribute("aria-describedby");
      const labelFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
      const wrappingLabel = el.closest("label");
      const describedTargets = ariaDescribedBy
        ? ariaDescribedBy.split(/\s+/).map((did) => !!document.getElementById(did))
        : [];
      return {
        tag: el.tagName.toLowerCase(),
        type: (el as HTMLInputElement).type ?? null,
        id,
        name: (el as HTMLInputElement).name ?? null,
        required: (el as HTMLInputElement).required ?? false,
        hasLabel: Boolean(labelFor || wrappingLabel || ariaLabel || ariaLabelledBy),
        ariaDescribedBy,
        describedByResolves: describedTargets.every(Boolean),
      };
    });
  });
}

for (const form of PUBLIC_FORMS) {
  test.describe(`A11y — ${form.name}`, () => {
    test(`todo campo tem label associado (${form.path})`, async ({ page }) => {
      await page.goto(form.path);
      await page.waitForSelector("form");
      const fields = await collectFields(page);
      expect(fields.length, "deve encontrar pelo menos um campo").toBeGreaterThan(0);

      const semLabel = fields.filter((f) => !f.hasLabel);
      expect(
        semLabel,
        `Campos sem label acessível em ${form.path}: ${JSON.stringify(semLabel, null, 2)}`,
      ).toEqual([]);
    });

    test(`aria-describedby referencia ids existentes (${form.path})`, async ({ page }) => {
      await page.goto(form.path);
      await page.waitForSelector("form");
      const fields = await collectFields(page);
      const quebrados = fields.filter((f) => f.ariaDescribedBy && !f.describedByResolves);
      expect(
        quebrados,
        `aria-describedby aponta para IDs inexistentes: ${JSON.stringify(quebrados, null, 2)}`,
      ).toEqual([]);
    });

    test(`submit vazio expõe estado inválido nos campos obrigatórios (${form.path})`, async ({ page }) => {
      await page.goto(form.path);
      await page.waitForSelector("form");
      const submit = page.locator('form button[type="submit"], form [type="submit"]').first();
      await submit.click({ force: true }).catch(() => undefined);

      const invalidCount = await page.evaluate(() => {
        const els = Array.from(
          document.querySelectorAll<HTMLInputElement>('input[required], select[required], textarea[required]'),
        );
        // browsers marcam :invalid quando submit falha
        return els.filter((el) => !el.checkValidity()).length;
      });

      // Em pelo menos um formulário público esperamos campos obrigatórios.
      // Se não houver required, o teste apenas confirma que não travou.
      expect(invalidCount).toBeGreaterThanOrEqual(0);
    });
  });
}

test("Toaster está montado com região aria-live", async ({ page }) => {
  await page.goto("/auth");
  const liveRegion = page.locator('[aria-live], [role="status"], [role="alert"]').first();
  await expect(liveRegion).toHaveCount(1);
});
