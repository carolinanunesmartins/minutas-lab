import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('the form pane has zero serious/critical axe violations', async ({ page }) => {
  await page.goto('/');
  await page.locator('#field-vendedor_nome').fill('Maria Exemplo Silva');
  await page.waitForTimeout(500);

  const results = await new AxeBuilder({ page }).include('form').withTags(['wcag2a', 'wcag2aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
});

test('keyboard navigation reaches the download buttons', async ({ page }) => {
  await page.goto('/');
  await page.locator('#field-vendedor_nome').focus();
  await page.keyboard.press('Tab');
  const active = await page.evaluate(() => document.activeElement?.tagName);
  expect(active).toBe('INPUT');

  await expect(page.getByRole('button', { name: 'Descarregar rascunho' })).toBeVisible();
  await page.getByRole('button', { name: 'Descarregar rascunho' }).focus();
  const focused = await page.evaluate(() => document.activeElement?.textContent);
  expect(focused).toBe('Descarregar rascunho');
});
