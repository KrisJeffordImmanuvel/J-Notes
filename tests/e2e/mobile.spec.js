import { test, expect } from '@playwright/test';
import { openFresh, waitSaved } from './helpers.js';

test('mobile: write in the note and find text with the toolbar button', async ({ page }) => {
  await openFresh(page);
  await page.locator('#edText').fill('Packing list\n- passport\n- charger');
  await waitSaved(page);
  await page.getByRole('button', { name: 'Find in note' }).click();
  await page.locator('#findIn').fill('charger');
  await expect(page.locator('#findCount')).toHaveText('1 of 1');
  await expect(page.getByRole('button', { name: 'Focus mode' })).toBeHidden();      // hidden on small screens
});
