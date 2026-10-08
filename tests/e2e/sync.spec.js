import { test, expect } from '@playwright/test';
import { createFakeDrive } from '../support/fake-drive.js';
import { openFresh, routeGoogle, unlock, quickNote } from './helpers.js';

async function openNote(page, title) {
  await page.getByRole('button', { name: /All notes/ }).click();
  await page.locator('.note-item', { hasText: title }).click();
}
const cloud = drive => ([...drive.files.values()][0] || {});

test('laptop and phone stay in sync, and the cloud copy is encrypted', async ({ browser }) => {
  const drive = createFakeDrive();

  // Laptop: first device ever — sign in, choose a PIN, write a note
  const laptop = await (await browser.newContext()).newPage();
  await openFresh(laptop, { drive });
  await quickNote(laptop, 'Trip ideas\nKyoto in spring');
  await expect.poll(() => cloud(drive).content || '', { timeout: 15000 }).toContain('"enc":true');
  expect(cloud(drive).content).not.toContain('Kyoto');
  expect(drive.files.size).toBe(1);

  // Phone: sign in, unlock with the same PIN, and the note is there
  const phone = await (await browser.newContext()).newPage();
  await routeGoogle(phone.context(), drive);
  await phone.goto('/');
  await phone.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(phone.getByRole('heading', { name: 'J Notes is locked' })).toBeVisible();
  await unlock(phone);
  await openNote(phone, 'Trip ideas');
  await expect(phone.locator('#edText')).toHaveValue('Kyoto in spring');
  await expect(phone.getByRole('dialog', { name: 'Protect your notes' })).toHaveCount(0);   // already protected

  // Edit on the phone; the laptop picks it up
  const before = cloud(drive).version;
  await phone.locator('#edText').fill('Kyoto in spring, Osaka after');
  await expect.poll(() => cloud(drive).version, { timeout: 15000 }).toBeGreaterThan(before);
  await laptop.getByRole('button', { name: /^Synced/ }).click();
  await laptop.getByRole('button', { name: 'Sync now' }).click();
  await laptop.keyboard.press('Escape');
  await openNote(laptop, 'Trip ideas');
  await expect(laptop.locator('#edText')).toHaveValue('Kyoto in spring, Osaka after');
});
