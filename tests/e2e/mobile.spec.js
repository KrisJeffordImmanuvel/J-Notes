import { test, expect } from '@playwright/test';
import { openFresh, waitSaved, quickNote } from './helpers.js';

test('mobile: navigate with the drawer and edit a note', async ({ page }) => {
  await openFresh(page);
  await quickNote(page, 'Phone note\nwritten on the go');
  await page.getByRole('button', { name: 'Open menu' }).first().click();
  await page.getByRole('button', { name: /All notes/ }).click();
  await page.locator('.note-item', { hasText: 'Phone note' }).click();
  await page.locator('#edTitle').fill('Phone note, edited');
  await waitSaved(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.note-item', { hasText: 'Phone note, edited' })).toBeVisible();
});
