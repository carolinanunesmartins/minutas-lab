import { expect, test } from '@playwright/test';
import { CPCV_DEMO_VALUES } from './fixtures/values';
import { fillField } from './fixtures/fillField';

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

test('filling a field updates the live preview with the value once the field is left', async ({ page }) => {
  // The preview refreshes on blur, not per keystroke (deliberate — no worker
  // round-trip per character), so leaving the field is part of the flow.
  await page.locator('#field-vendedor_nome').fill('Maria Exemplo Silva');
  await page.locator('#field-vendedor_nome').blur();
  const preview = page.locator('.docx-preview-pane[data-active="true"]').first();
  await expect(preview).toContainText('Maria Exemplo Silva', { timeout: 5000 });
});

test('empty required fields render as bracketed placeholders in the preview', async ({ page }) => {
  await page.locator('#field-vendedor_nome').fill('Maria Exemplo Silva');
  await page.locator('#field-vendedor_nome').blur();
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
    await fillField(page, id, value);
  }
  await expect(page.getByRole('button', { name: 'Descarregar minuta' })).toBeEnabled({ timeout: 5000 });
  await page.getByRole('button', { name: 'Descarregar minuta' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Confirmar e descarregar' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/);
});

test('focusing an input scrolls the preview to that field, even while it is still empty', async ({ page }) => {
  const preview = page.locator('.docx-preview-pane[data-active="true"]').first();
  await expect(preview.locator('[data-field="preco_total"]').first()).toBeAttached({ timeout: 5000 });
  expect(await preview.evaluate((el) => el.scrollTop)).toBe(0);
  await page.locator('#field-preco_total').focus();
  await expect.poll(() => preview.evaluate((el) => el.scrollTop), { timeout: 5000 }).toBeGreaterThan(500);
});

test('clicking a field in the preview focuses its input, reopening a collapsed group', async ({ page }) => {
  const preview = page.locator('.docx-preview-pane[data-active="true"]').first();
  const group = page.locator('details', { hasText: 'Foro e assinatura' });
  await group.locator('summary').click();
  await expect(group).not.toHaveAttribute('open', '');
  // Let any blur-triggered rebuild + scroll settle before targeting the pane.
  await page.waitForTimeout(1200);
  const run = preview.locator('[data-field="foro_comarca"]').first();
  await run.scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  await run.click();
  await expect(group).toHaveAttribute('open', '');
  await expect(page.locator('#field-foro_comarca')).toBeFocused();
});

test('ticking a checkbox adds its clause to the preview at once and scrolls to it', async ({ page }) => {
  const preview = page.locator('.docx-preview-pane[data-active="true"]').first();
  await expect(preview.locator('[data-field="preco_total"]').first()).toBeAttached({ timeout: 5000 });
  const before = (await preview.textContent())?.length ?? 0;
  expect(await preview.evaluate((el) => el.scrollTop)).toBe(0);

  const checkbox = page.getByLabel('Existem ónus ou encargos sobre o imóvel?');
  await expect(page.getByText('Cláusula não incluída na minuta').first()).toBeVisible();
  await checkbox.check(); // no blur: the change itself must refresh the preview
  await expect(page.getByText(/Cláusula incluída na minuta/).first()).toBeVisible();
  await expect.poll(async () => (await preview.textContent())?.length ?? 0, { timeout: 5000 }).toBeGreaterThan(before);
  await expect(preview.locator('[data-blocks~="onus"]')).toBeAttached();
  await expect.poll(() => preview.evaluate((el) => el.scrollTop), { timeout: 5000 }).toBeGreaterThan(300);

  // ...and unticking removes it again.
  await checkbox.uncheck();
  await expect.poll(async () => (await preview.textContent())?.length ?? 0, { timeout: 5000 }).toBeLessThanOrEqual(before + 5);
});

test('a blocked download shows an error summary that links to each problem', async ({ page }) => {
  await page.getByRole('button', { name: 'Descarregar minuta' }).click({ force: true });
  const summary = page.getByRole('region', { name: 'Há campos por corrigir' });
  await expect(summary).toBeFocused();
  await expect(page.getByRole('alert').filter({ hasText: 'por corrigir' })).toBeVisible();
  await summary.getByRole('button', { name: /Nome do promitente-vendedor/ }).click();
  await expect(page.locator('#field-vendedor_nome')).toBeFocused();
});

test('a malformed value is flagged as soon as the field is left, empty ones stay quiet', async ({ page }) => {
  await page.locator('#field-vendedor_nif').fill('123');
  await page.locator('#field-vendedor_nif').blur();
  await expect(page.getByText('o NIF tem 9 dígitos')).toBeVisible();
  await page.locator('#field-vendedor_nome').focus();
  await page.locator('#field-vendedor_nome').blur();
  await expect(page.getByText('Campo obrigatório.')).toHaveCount(0);
  await page.locator('#field-vendedor_nif').fill('252601815');
  await expect(page.getByText('o NIF tem 9 dígitos')).toHaveCount(0);
});

test('progress shows how many required fields are filled', async ({ page }) => {
  const progress = page.getByRole('group', { name: 'Campos obrigatórios preenchidos' });
  // Some required fields ship with defaults (e.g. deadline days), so start from whatever is filled.
  const filled = async (): Promise<number> => Number(/(\d+)\/\d+/.exec((await progress.textContent()) ?? '')?.[1]);
  const before = await filled();
  await fillField(page, 'vendedor_nome', 'Maria Exemplo Silva');
  await expect.poll(filled).toBe(before + 1);
});

test('on a phone the sticky preview can be hidden and shown again', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const body = page.locator('#preview-body');
  await expect(body).toBeVisible();
  await page.getByRole('button', { name: 'Ocultar' }).click();
  await expect(body).toBeHidden();
  await page.getByRole('button', { name: 'Mostrar' }).click();
  await expect(body).toBeVisible();
});

test('data can be saved to a JSON file and loaded back', async ({ page }, testInfo) => {
  await fillField(page, 'vendedor_nome', 'Maria Exemplo Silva');
  await fillField(page, 'vendedor_nif', '252601815');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Guardar dados (.json)' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('cpcv-dados.json');
  const file = testInfo.outputPath('cpcv-dados.json');
  await download.saveAs(file);

  await fillField(page, 'vendedor_nome', 'Outra Pessoa');
  await fillField(page, 'vendedor_nif', '');
  await page.getByTestId('draft-input').setInputFiles(file);
  await expect(page.getByText('Dados carregados do ficheiro.')).toBeVisible();
  await expect(page.locator('#field-vendedor_nome')).toHaveValue('Maria Exemplo Silva');
  await expect(page.locator('#field-vendedor_nif')).toHaveValue('252601815');
});

test('the preview fits its pane width and can be zoomed', async ({ page }) => {
  const zoomOf = (): Promise<number> =>
    page.evaluate(() => Number(document.querySelector<HTMLElement>('.docx-preview-pane[data-active="true"] .docx-wrapper')?.style.zoom));
  await expect.poll(zoomOf).toBeGreaterThan(0.5);
  const fit = await zoomOf();
  expect(fit).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Diminuir zoom' }).click();
  await expect.poll(zoomOf).toBeLessThan(fit);
  await page.getByRole('button', { name: 'Ajustar à largura' }).click();
  await expect.poll(zoomOf).toBeCloseTo(fit, 1);
});

test('the review dialog lists optional clauses, links back to them, and closes with Escape', async ({ page }) => {
  for (const [id, value] of Object.entries(CPCV_DEMO_VALUES)) await fillField(page, id, value);
  await page.getByLabel('Existem ónus ou encargos sobre o imóvel?').check();
  await fillField(page, 'onus_descricao', 'Hipoteca a favor de um banco');
  await page.getByRole('button', { name: 'Descarregar minuta' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Cláusulas opcionais')).toBeVisible();
  await expect(dialog.getByText('Incluída', { exact: true })).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Descarregar minuta' }).click();
  await dialog.getByRole('button', { name: /Alterar.*ónus/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('#field-onus')).toBeFocused();
});
