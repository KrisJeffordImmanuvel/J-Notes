import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { openFresh, setPin, unlock, waitSaved, storedRecord, PIN } from './helpers.js';

test('first start asks for a PIN that cannot be skipped, then opens the note', async ({ page }) => {
  await page.goto('/');
  const dialog = page.getByRole('dialog', { name: 'Protect your note' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
  await setPin(page);
  await expect(page.locator('#edText')).toBeVisible();
  await expect(page.locator('.note-item, .sidebar, [data-act=newNote]')).toHaveCount(0);   // one note only
});

test('the note survives a reload and lists continue on Enter', async ({ page }) => {
  await openFresh(page);
  await page.locator('#edText').click();
  await page.keyboard.type('- milk\neggs\n\nafter the list');
  await expect(page.locator('#edText')).toHaveValue('- milk\n- eggs\nafter the list');
  await waitSaved(page);
  await page.reload();
  await unlock(page);
  await expect(page.locator('#edText')).toHaveValue('- milk\n- eggs\nafter the list');
});

test('the note is stored encrypted and opens only with the right PIN', async ({ page }) => {
  await openFresh(page);
  await page.locator('#edText').fill('the treasure is under the oak');
  await waitSaved(page);
  const stored = await storedRecord(page);
  expect(stored).toContain('"enc":true');
  expect(stored).not.toContain('treasure');

  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Security/ }).click();
  await expect(page.getByRole('button', { name: 'Turn off app lock' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.keyboard.press('Alt+l');
  await expect(page.getByRole('heading', { name: 'J Notes is locked' })).toBeVisible();
  await page.locator('#pinIn').fill('0000');
  await page.locator('#unlockBtn').click();
  await expect(page.locator('#lockErr')).toHaveText('That PIN is not right.');
  await unlock(page, PIN);
  await expect(page.locator('#edText')).toHaveValue('the treasure is under the oak');
});

test('find in note highlights matches and steps through them', async ({ page }) => {
  await openFresh(page);
  await page.locator('#edText').fill('Call mum about the trip.\nThe trip is in May.\nBook the TRIP hotel.');
  await page.keyboard.press('Control+f');
  await page.keyboard.type('trip');
  await expect(page.locator('#findCount')).toHaveText(/of 3$/);
  await expect(page.locator('#edBackdrop mark')).toHaveCount(3);
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  await expect(page.locator('#findCount')).toHaveText(/of 3$/);
  await page.locator('#findIn').fill('nothing here');
  await expect(page.locator('#findCount')).toHaveText('No matches');
  await page.keyboard.press('Escape');
  await expect(page.locator('#findBar')).toBeHidden();
});

test('read mode renders Markdown and ticks checklist items', async ({ page }) => {
  await openFresh(page);
  await page.locator('#edText').fill('# Today\n\n- [ ] water plants\n- [ ] post letter');
  await page.keyboard.press('Control+e');
  await expect(page.locator('#edPreview h1')).toHaveText('Today');
  await page.locator('#edPreview input[type=checkbox]').first().check();
  await page.keyboard.press('Control+e');
  await expect(page.locator('#edText')).toHaveValue('# Today\n\n- [x] water plants\n- [ ] post letter');
});

test('version history restores an earlier version', async ({ page }) => {
  await openFresh(page);
  await page.locator('#edText').fill('first draft');
  await page.getByRole('button', { name: 'Version history' }).click();     // keeps "first draft" as a version
  await page.keyboard.press('Escape');
  await page.locator('#edText').fill('second draft');
  await page.getByRole('button', { name: 'Version history' }).click();
  await page.locator('#hList button').nth(1).click();
  await expect(page.locator('#hPrev')).toContainText('first draft');
  await page.getByRole('button', { name: 'Restore this version' }).click();
  await expect(page.locator('#edText')).toHaveValue('first draft');
});

test('downloads the note as Markdown', async ({ page }) => {
  await openFresh(page);
  await page.locator('#edText').fill('# Plans\n\nSee the sea.');
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Backup/ }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Note as Markdown/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^J Notes .*\.md$/);
  expect(readFileSync(await download.path(), 'utf8')).toBe('# Plans\n\nSee the sea.\n');
});

test('works offline once loaded', async ({ page, context }) => {
  await openFresh(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.locator('#edText').fill('Written before going offline');
  await waitSaved(page);
  await context.setOffline(true);
  await page.reload();
  await unlock(page);
  await expect(page.locator('#edText')).toHaveValue('Written before going offline');
});

test('the single-file build works from disk and still requires a PIN', async ({ page }) => {
  const path = (await import('node:path')).resolve('dist-single/J_Notes.html');
  await page.goto('file://' + path);
  await setPin(page);
  await expect(page.locator('#edText')).toBeVisible();
  await expect(page.locator('link[rel=manifest]')).toHaveCount(0);
  await expect(page.locator('script[src]')).toHaveCount(0);
});
