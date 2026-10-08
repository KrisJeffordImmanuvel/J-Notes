import { createFakeDrive, FAKE_GIS } from '../support/fake-drive.js';

export const PIN = '2468';
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Expose-Headers': 'Location' };

/** Send this browser profile's Google traffic to a fake Google (sign-in script + Drive). */
export async function routeGoogle(context, drive) {
  await context.route('https://accounts.google.com/gsi/client', r => r.fulfill({ contentType: 'text/javascript', body: FAKE_GIS }));
  await context.route('https://www.googleapis.com/**', async route => {
    const req = route.request();
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const r = drive.handle(req.method(), req.url(), await req.allHeaders(), req.postData() || '');
    return route.fulfill({ status: r.status, contentType: r.contentType, body: r.body, headers: CORS });
  });
}

/** Answer the required "Protect your notes" dialog, then skip the recovery-key check. */
export async function setPin(page, pin = PIN) {
  const dialog = page.getByRole('dialog', { name: 'Protect your notes' });
  await dialog.waitFor();
  await page.locator('#lk1').fill(pin);
  await page.locator('#lk2').fill(pin);
  await page.locator('#lkOk').click();
  await page.locator('.words div').nth(23).waitFor();          // key derivation takes a moment
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Save your recovery key' }).waitFor({ state: 'detached' });
}

/** First start on a new device: sign in with (fake) Google, set the PIN, land on Home. */
export async function openFresh(page, { drive = createFakeDrive() } = {}) {
  await routeGoogle(page.context(), drive);
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  await setPin(page);
  await page.locator('.home-head h1').waitFor();
  return drive;
}

export async function unlock(page, pin = PIN) {
  await page.locator('#pinIn').fill(pin);
  await page.locator('#unlockBtn').click();
  await page.locator('#lockScreen').waitFor({ state: 'hidden' });
}

/** Wait until the app reports that everything is saved. */
export async function waitSaved(page) {
  await page.locator('.js-status').first().filter({ hasText: /^Saved/ }).waitFor();
}

export async function quickNote(page, text) {
  await page.keyboard.press('Alt+h');                    // Home (works with the mobile drawer closed too)
  await page.locator('#quickText').fill(text);
  await page.getByRole('button', { name: 'Save note' }).click();
}
