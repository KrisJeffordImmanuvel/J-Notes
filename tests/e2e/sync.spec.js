import { test, expect } from '@playwright/test';
import { createFakeDrive, FAKE_GIS } from '../support/fake-drive.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Location' };

/** A browser profile ("device") whose Google traffic goes to the shared fake Drive. */
async function device(browser, drive) {
  const context = await browser.newContext();
  await context.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  await context.route('https://www.googleapis.com/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const r = drive.handle(req.method(), req.url(), await req.allHeaders(), req.postData() || '');
    return route.fulfill({ status: r.status, contentType: r.contentType, body: r.body, headers: CORS });
  });
  const page = await context.newPage();
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Welcome to J Notes' }).waitFor();
  return page;
}

async function openNote(page, title) {
  await page.getByRole('button', { name: /All notes/ }).click();
  await page.locator('.note-item', { hasText: title }).click();
}

test('sign in with Google on two devices and sync notes both ways', async ({ browser }) => {
  const drive = createFakeDrive();

  // Laptop: write a note, then sign in from Settings → Account & sync
  const laptop = await device(browser, drive);
  await laptop.keyboard.press('Escape');
  await laptop.locator('#quickText').fill('Trip ideas\nKyoto in spring');
  await laptop.getByRole('button', { name: 'Save note' }).click();
  await laptop.getByRole('button', { name: 'Settings', exact: true }).click();
  await laptop.getByRole('button', { name: /Account & sync/ }).click();
  await laptop.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(laptop.getByText('Signed in as kris@example.com')).toBeVisible();
  await expect(laptop.locator('.modal').getByText(/^Synced/)).toBeVisible();
  expect(drive.files.size).toBe(1);

  // Phone: a fresh install signs in straight from the welcome dialog
  const phone = await device(browser, drive);
  await phone.getByRole('button', { name: 'Continue with Google' }).click();
  await expect(phone.getByRole('dialog', { name: 'Welcome to J Notes' })).toHaveCount(0);
  await openNote(phone, 'Trip ideas');
  await expect(phone.locator('#edText')).toHaveValue('Kyoto in spring');
  await expect(phone.locator('.note-item', { hasText: 'Welcome to J Notes' })).toHaveCount(1);

  // Edit on the phone; the laptop picks it up
  await phone.locator('#edText').fill('Kyoto in spring, Osaka after');
  await expect.poll(() => [...drive.files.values()][0].content.includes('Osaka after'), { timeout: 15000 }).toBe(true);
  await laptop.keyboard.press('Escape');
  await laptop.getByRole('button', { name: /^Synced/ }).click();         // sidebar status → Account & sync
  await laptop.getByRole('button', { name: 'Sync now' }).click();
  await laptop.keyboard.press('Escape');
  await openNote(laptop, 'Trip ideas');
  await expect(laptop.locator('#edText')).toHaveValue('Kyoto in spring, Osaka after');

  // Sign out keeps the notes on the device
  await laptop.getByRole('button', { name: /^Synced/ }).click();
  await laptop.getByRole('button', { name: 'Sign out' }).click();
  await laptop.getByRole('button', { name: 'Sign out' }).last().click();
  await expect(laptop.getByText('Signed out — notes stay on this device.')).toBeVisible();
  await expect(laptop.locator('.modal').getByRole('button', { name: 'Continue with Google' })).toBeVisible();
});
