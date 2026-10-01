import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const CPCV_TITLE = 'Contrato-promessa de compra e venda de imóvel';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('the template picker has zero serious/critical axe violations', async ({ page }) => {
  await page.waitForTimeout(700); // let the staggered card entrance animation settle before scanning colors
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test('the form pane has zero serious/critical axe violations', async ({ page }) => {
  await page.getByRole('button', { name: CPCV_TITLE }).click();
  await page.locator('#field-vendedor_nome').fill('Maria Exemplo Silva');
  await page.waitForTimeout(500);

  const results = await new AxeBuilder({ page }).include('form').withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test('keyboard navigation reaches the download buttons', async ({ page }) => {
  await page.getByRole('button', { name: CPCV_TITLE }).click();
  await page.locator('#field-vendedor_nome').focus();
  await page.keyboard.press('Tab');
  // The next field could be a plain input, a <select> (closed-choice fields
  // like estado civil), or a native date input — all still form controls.
  const active = await page.evaluate(() => document.activeElement?.tagName);
  expect(['INPUT', 'SELECT']).toContain(active);

  await expect(page.getByRole('button', { name: 'Descarregar rascunho' })).toBeVisible();
  await page.getByRole('button', { name: 'Descarregar rascunho' }).focus();
  const focused = await page.evaluate(() => document.activeElement?.textContent);
  expect(focused).toBe('Descarregar rascunho');
});
