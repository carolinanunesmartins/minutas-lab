import { expect, test } from '@playwright/test';
import { CPCV_DEMO_VALUES } from './fixtures/values';

test('loads the CPCV form and shows the live preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'minutas-lab' })).toBeVisible();
  await expect(page.locator('#field-vendedor_nome')).toBeVisible();
});

test('filling a field updates the live preview with the value', async ({ page }) => {
  await page.goto('/');
  await page.locator('#field-vendedor_nome').fill('Maria Exemplo Silva');
  const preview = page.locator('.docx-preview-pane:not(.hidden)').first();
  await expect(preview).toContainText('Maria Exemplo Silva', { timeout: 5000 });
});

test('empty required fields render as bracketed placeholders in the preview', async ({ page }) => {
  await page.goto('/');
  await page.locator('#field-vendedor_nome').fill('Maria Exemplo Silva');
  const preview = page.locator('.docx-preview-pane:not(.hidden)').first();
  await expect(preview).toContainText('[vendedor_nif]', { timeout: 5000 });
});

test('the "descarregar minuta" button is disabled while required fields are missing', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Descarregar minuta' })).toBeDisabled();
});

test('"descarregar rascunho" is always enabled and downloads a .docx', async ({ page }) => {
  await page.goto('/');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descarregar rascunho' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
});

test('final download review screen appears once all fields are validly filled', async ({ page }) => {
  await page.goto('/');
  for (const [id, value] of Object.entries(CPCV_DEMO_VALUES)) {
    await page.locator(`#field-${id}`).fill(value);
  }
  await expect(page.getByRole('button', { name: 'Descarregar minuta' })).toBeEnabled({ timeout: 5000 });
  await page.getByRole('button', { name: 'Descarregar minuta' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Confirmar e descarregar' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
});
