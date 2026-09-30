import { expect, test } from '@playwright/test';
import { CPCV_DEMO_VALUES } from './fixtures/values';

const CPCV_TITLE = 'Contrato-promessa de compra e venda de imóvel';

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: CPCV_TITLE }).click();
});

test('picking a template loads its form and shows the live preview', async ({ page }) => {
  // The h1 on the working screen is the loaded document's own title (the thing
  // being edited), not the app wordmark — that's a <p> in the header instead.
  await expect(page.getByRole('heading', { name: CPCV_TITLE })).toBeVisible();
  await expect(page.locator('#field-vendedor_nome')).toBeVisible();
});

test('the template picker lists all 4 templates', async ({ page }) => {
  await page.getByRole('button', { name: 'Escolher outra minuta' }).click();
  await expect(page.getByRole('button', { name: 'Contrato de Arrendamento Urbano para Habitação' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Contrato de Empreitada' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Procuração' })).toBeVisible();
  await expect(page.getByRole('button', { name: CPCV_TITLE })).toBeVisible();
});

test('filling a field updates the live preview with the value', async ({ page }) => {
  await page.locator('#field-vendedor_nome').fill('Maria Exemplo Silva');
  const preview = page.locator('.docx-preview-pane[data-active="true"]').first();
  await expect(preview).toContainText('Maria Exemplo Silva', { timeout: 5000 });
});

test('empty required fields render as bracketed placeholders in the preview', async ({ page }) => {
  await page.locator('#field-vendedor_nome').fill('Maria Exemplo Silva');
  const preview = page.locator('.docx-preview-pane[data-active="true"]').first();
  await expect(preview).toContainText('[vendedor_nif]', { timeout: 5000 });
});

test('the "descarregar minuta" button is disabled while required fields are missing', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Descarregar minuta' })).toBeDisabled();
});

test('"descarregar rascunho" is always enabled and downloads a .docx', async ({ page }) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descarregar rascunho' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
});

test('final download review screen appears once all fields are validly filled', async ({ page }) => {
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
