import { test, expect } from '@playwright/test';
import { openFresh, waitSaved } from './helpers.js';

test('mobile: navigate with the drawer and edit a note', async ({ page }) => {
  await openFresh(page);
  await page.getByRole('button', { name: 'Open menu' }).first().click();
  await page.getByRole('button', { name: /All notes/ }).click();
  await page.locator('.note-item', { hasText: 'Welcome to J Notes' }).click();
  await page.locator('#edTitle').fill('Welcome, edited');
  await waitSaved(page);
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page.locator('.note-item', { hasText: 'Welcome, edited' })).toBeVisible();
});
