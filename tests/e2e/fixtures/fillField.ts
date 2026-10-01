import type { Page } from '@playwright/test';

/**
 * Fills a form field regardless of control type: text `<input>`, `<select>`
 * (needs selectOption, not fill), or `<input type="date">` (needs its value
 * in ISO yyyy-mm-dd, while `values.ts` stores the app's pt-PT dd/mm/aaaa
 * display format — same convention `Form.tsx` converts between).
 */
export async function fillField(page: Page, id: string, value: string): Promise<void> {
  const locator = page.locator(`#field-${id}`);
  const { tag, type } = await locator.evaluate((el) => ({ tag: el.tagName, type: el.getAttribute('type') }));
  if (tag === 'SELECT') {
    await locator.selectOption(value);
  } else if (type === 'date') {
    const [day, month, year] = value.split('/');
    await locator.fill(`${year}-${month}-${day}`);
  } else {
    await locator.fill(value);
  }
}
