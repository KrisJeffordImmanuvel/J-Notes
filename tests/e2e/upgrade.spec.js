/* Opening J Notes 2 on a device that has data from version 1 (many notes, a diary, a PIN). */
import { test, expect } from '@playwright/test';
import { wrapWith, importRaw, aesEnc } from '../../src/lib/crypto.js';
import { enc, rand } from '../../src/lib/util.js';
import { setPin, unlock, storedRecord, PIN } from './helpers.js';

const t = Date.parse('2026-10-01T09:00:00');
const note = over => ({ id: Math.random().toString(36).slice(2), type: 'note', title: '', body: '', notebookId: null, tags: [], pinned: false, fav: false, created: t, updated: t, deleted: null, history: [], ...over });
const oldData = {
  v: 1, settings: { theme: 'dark', onboarded: true }, notebooks: [{ id: 'nb1', name: 'Personal' }], attachments: {}, tombstones: {},
  notes: [
    note({ title: 'Welcome to J Notes', body: 'J Notes is a calm, private place for your notes and your diary. Everything stays on this device.' }),
    note({ title: 'Shopping', body: '- milk\n- bread', created: t + 2e8 }),
    note({ type: 'diary', date: '2026-10-02', body: 'Walked by the sea.', mood: 4, created: t + 1e8 }),
    note({ title: 'Old idea', body: 'in the trash', deleted: t })
  ]
};

async function seed(page, record) {
  await page.addInitScript(r => {
    if (localStorage.getItem('seeded')) return;
    localStorage.setItem('seeded', '1');
    localStorage.setItem('jnotes:v1', r);
  }, record);
}
const expectCombined = async page => {
  const body = await page.locator('#edText').inputValue();
  expect(body).toMatch(/^## .*October.*2.*2026/);               // diary entry (2 Oct) first, then Shopping (later)
  expect(body).toContain('*Mood: Good*');
  expect(body).toContain('## Shopping\n\n- milk\n- bread');
  expect(body.indexOf('Walked by the sea')).toBeLessThan(body.indexOf('## Shopping'));
  expect(body).not.toContain('Welcome to J Notes');
  expect(body).not.toContain('in the trash');
  await expect(page.getByText(/Your 2 notes and diary entries are now one note/)).toBeVisible();
};
const expectSnapshotKept = async page => {
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: /Backup/ }).click();
  await expect(page.getByText('Before the single-note update')).toBeVisible();
};

test('old notes protected by a PIN are combined into one note after unlocking', async ({ page }) => {
  // build a version-1 record exactly as the old app stored it
  const raw = rand(32), key = await importRaw(raw);
  const record = JSON.stringify({
    v: 1, app: 'J Notes', enc: true, lockAt: t,
    pin: await wrapWith(PIN, raw), rec: await wrapWith('apple amber anchor', raw),
    payload: await aesEnc(key, enc(JSON.stringify(oldData)))
  });
  await seed(page, record);
  await page.goto('/');
  await unlock(page);
  await expectCombined(page);
  const stored = await storedRecord(page);
  expect(stored).toContain('"enc":true');
  expect(stored).not.toContain('Walked by the sea');
  await expectSnapshotKept(page);

  // the same PIN still opens it after a reload
  await page.reload();
  await unlock(page);
  await expect(page.locator('#edText')).toHaveValue(/## Shopping/);
});

test('old notes without a PIN are combined, then a PIN is required', async ({ page }) => {
  await seed(page, JSON.stringify({ v: 1, app: 'J Notes', enc: false, data: oldData }));
  await page.goto('/');
  await setPin(page);
  await expectCombined(page);
  await expectSnapshotKept(page);
});
