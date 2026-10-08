import { test, expect } from '@playwright/test';
import { createFakeDrive } from '../support/fake-drive.js';
import { openFresh, routeGoogle, unlock, waitSaved, quickNote, PIN } from './helpers.js';

test('a new device asks for the owner\'s Google account, then a PIN that cannot be skipped', async ({ page }) => {
  await routeGoogle(page.context(), createFakeDrive());
  await page.goto('/');
  await expect(page.getByText('Sign in with your Google account to open your notes on this device.')).toBeVisible();
  await expect(page.locator('#main')).toBeEmpty();
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const dialog = page.getByRole('dialog', { name: 'Protect your notes' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  await expect(dialog).toBeVisible();                                   // still there
  await expect(dialog.getByRole('button', { name: 'Close' })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toHaveCount(0);
});

test('anyone else\'s Google account is turned away', async ({ page }) => {
  const drive = createFakeDrive({ email: 'someone.else@example.com' });
  await routeGoogle(page.context(), drive);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.locator('#gateErr')).toContainText("isn't the owner's Google account");
  await expect(page.locator('.home-head h1')).toHaveCount(0);
  expect(drive.files.size).toBe(0);
});

test('creates a note that survives a reload', async ({ page }) => {
  await openFresh(page);
  await page.keyboard.press('Alt+n');
  await page.locator('#edTitle').fill('Shopping list');
  await page.locator('#edText').click();
  await page.keyboard.type('- milk\nbread');
  await expect(page.locator('#edText')).toHaveValue('- milk\n- bread');   // list continues on Enter
  await waitSaved(page);

  await page.reload();
  await unlock(page);
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
  await quickNote(page, 'Old idea\nmaybe later');
  await page.getByRole('button', { name: /All notes/ }).click();
  await page.locator('.note-item', { hasText: 'Old idea' }).click();
  await page.getByRole('button', { name: 'More options' }).click();
  await page.getByRole('menuitem', { name: 'Move to Trash' }).click();
  await page.getByRole('button', { name: /^Trash/ }).click();
  await page.locator('.note-item', { hasText: 'Old idea' }).click();
  await page.getByRole('button', { name: 'Restore' }).click();
  await expect(page.locator('#edTitle')).toHaveValue('Old idea');
});

test('notes are always encrypted and open only with the right PIN', async ({ page }) => {
  await openFresh(page);
  await quickNote(page, 'Secret plans\nthe treasure is under the oak');
  await waitSaved(page);

  const stored = await page.evaluate(() => new Promise(res => {
    const r = indexedDB.open('jnotes'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('jnotes:v1'); q.onsuccess = () => res(q.result); };
  }));
  expect(stored).toContain('"enc":true');
  expect(stored).not.toContain('treasure');

  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: /Security/ }).click();
  await expect(page.getByRole('button', { name: 'Turn off app lock' })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.keyboard.press('Alt+l');
  await expect(page.getByRole('heading', { name: 'J Notes is locked' })).toBeVisible();
  await page.locator('#pinIn').fill('0000');
  await page.locator('#unlockBtn').click();
  await expect(page.locator('#lockErr')).toHaveText('That PIN is not right.');
  await unlock(page, PIN);
  await expect(page.getByText('Secret plans').first()).toBeVisible();

  await page.reload();
  await unlock(page);
  await expect(page.getByText('Secret plans').first()).toBeVisible();
});

test('works offline once loaded', async ({ page, context }) => {
  await openFresh(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await quickNote(page, 'Written before going offline');
  await waitSaved(page);
  await context.setOffline(true);
  await page.reload();
  await unlock(page);
  await expect(page.getByText('Written before going offline').first()).toBeVisible();
});

test('the single-file build works from disk without sign-in', async ({ page }) => {
  const path = (await import('node:path')).resolve('dist-single/J_Notes.html');
  await page.goto('file://' + path);
  await expect(page.locator('.home-head h1')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Continue with Google' })).toHaveCount(0);
  await expect(page.locator('link[rel=manifest]')).toHaveCount(0);
  await expect(page.locator('script[src]')).toHaveCount(0);
});

test('existing notes without a PIN must be protected first, then sync is offered', async ({ page }) => {
  await routeGoogle(page.context(), createFakeDrive());
  // notes saved by an earlier version, unencrypted, in this browser
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    const t = Date.now();
    localStorage.setItem('jnotes:v1', JSON.stringify({ v: 1, app: 'J Notes', enc: false, data: {
      v: 1, settings: { onboarded: true }, notebooks: [], attachments: {},
      notes: [{ id: 'n1', type: 'note', title: 'Laptop note', body: 'already here', notebookId: null, tags: [], pinned: false, fav: false, created: t, updated: t, deleted: null, history: [] }]
    } }));
  });
  await page.goto('/');
  await expect(page.getByRole('dialog', { name: 'Protect your notes' })).toBeVisible();
  await page.locator('#lk1').fill(PIN);
  await page.locator('#lk2').fill(PIN);
  await page.locator('#lkOk').click();
  await page.locator('.words div').nth(23).waitFor();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Account & sync' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(page.getByText('Signed in as kris@example.com')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByText('Laptop note').first()).toBeVisible();
});
