import { test, expect } from '@playwright/test';
import { openFresh, waitSaved } from './helpers.js';

test('creates a note that survives a reload', async ({ page }) => {
  await openFresh(page);
  await page.keyboard.press('Alt+n');
  await page.locator('#edTitle').fill('Shopping list');
  await page.locator('#edText').click();
  await page.keyboard.type('- milk\nbread');
  await expect(page.locator('#edText')).toHaveValue('- milk\n- bread');   // list continues on Enter
  await waitSaved(page);

  await page.reload();
  await page.getByRole('button', { name: /All notes/ }).click();
  await page.locator('.note-item', { hasText: 'Shopping list' }).click();
  await expect(page.locator('#edText')).toHaveValue('- milk\n- bread');
});

test('writes a diary entry with a mood and finds it in search', async ({ page }) => {
  await openFresh(page);
  await page.getByRole('button', { name: "Today's entry", exact: true }).click();
  await page.locator('#edText').fill('Walked by the sea at sunset.');
  await page.locator('#moodRow').getByRole('button', { name: 'Great' }).click();
  await waitSaved(page);
  await expect(page.locator('.cal-day.sel .dot')).toHaveAttribute('style', /mood5/);

  await page.keyboard.press('Control+k');
  await page.locator('#sq').fill('sunset');
  await expect(page.locator('#sRes .sr')).toHaveCount(1);
  await expect(page.locator('#sRes mark')).toHaveText('sunset');
});

test('moves notes to trash and restores them', async ({ page }) => {
  await openFresh(page);
  await page.getByRole('button', { name: /All notes/ }).click();
  await page.locator('.note-item', { hasText: 'Welcome to J Notes' }).click();
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
  await page.getByRole('button', { name: /^Trash/ }).click();
  await page.locator('.note-item', { hasText: 'Welcome to J Notes' }).click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#edTitle')).toHaveValue('Welcome to J Notes');
});

test('app lock encrypts data and unlocks only with the right PIN', async ({ page }) => {
  await openFresh(page);
  await page.locator('#quickText').fill('Secret plans\nthe treasure is under the oak');
  await page.getByRole('button', { name: 'Save note' }).click();

  await page.getByRole('button', { name: 'Set up app lock' }).click();          // sidebar → Settings › Security
  await page.locator('.modal').getByRole('button', { name: 'Set up app lock' }).click();
  await page.locator('#lk1').fill('4321');
  await page.locator('#lk2').fill('4321');
  await page.locator('#lkOk').click();
  await expect(page.locator('.words div')).toHaveCount(24);             // key derivation takes a moment
  const words = await page.locator('.words div').evaluateAll(els => els.map(e => e.lastChild.textContent));
  expect(words).toHaveLength(24);
  await page.getByRole('button', { name: /I've saved it/ }).click();
  const [a, b] = await page.locator('.modal label').allTextContents();
  await page.locator('#rv1').fill(words[+a.match(/\d+/)[0] - 1]);
  await page.locator('#rv2').fill(words[+b.match(/\d+/)[0] - 1]);
  await page.locator('#rvOk').click();
  await waitSaved(page);

  // nothing readable is stored
  const stored = await page.evaluate(() => new Promise(res => {
    const r = indexedDB.open('jnotes'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('jnotes:v1'); q.onsuccess = () => res(q.result); };
  }));
  expect(stored).toContain('"enc":true');
  expect(stored).not.toContain('treasure');

  await page.keyboard.press('Alt+l');
  await expect(page.getByRole('heading', { name: 'J Notes is locked' })).toBeVisible();
  await page.locator('#pinIn').fill('0000');
  await page.locator('#unlockBtn').click();
  await expect(page.locator('#lockErr')).toHaveText('That PIN is not right.');
  await page.locator('#pinIn').fill('4321');
  await page.locator('#unlockBtn').click();
  await expect(page.getByText('Secret plans').first()).toBeVisible();

  // and after a reload
  await page.reload();
  await page.locator('#pinIn').fill('4321');
  await page.locator('#unlockBtn').click();
  await expect(page.getByText('Secret plans').first()).toBeVisible();
});

test('works offline once loaded', async ({ page, context }) => {
  await openFresh(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.locator('#quickText').fill('Written before going offline');
  await page.getByRole('button', { name: 'Save note' }).click();
  await waitSaved(page);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText('Written before going offline').first()).toBeVisible();
});

test('the single-file build works from disk', async ({ page }) => {
  const path = (await import('node:path')).resolve('dist-single/J_Notes.html');
  await page.goto('file://' + path);
  await page.getByRole('dialog', { name: 'Welcome to J Notes' }).waitFor();
  await expect(page.locator('link[rel=manifest]')).toHaveCount(0);
  await expect(page.locator('script[src]')).toHaveCount(0);
});
