export const PIN = '2468';

/** Answer the required "Protect your note" dialog, then skip the recovery-key check. */
export async function setPin(page, pin = PIN) {
  await page.getByRole('dialog', { name: 'Protect your note' }).waitFor();
  await page.locator('#lk1').fill(pin);
  await page.locator('#lk2').fill(pin);
  await page.locator('#lkOk').click();
  await page.locator('.words div').nth(23).waitFor();          // key derivation takes a moment
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', { name: 'Save your recovery key' }).waitFor({ state: 'detached' });
}

/** First start: set the PIN and land in the note. */
export async function openFresh(page) {
  await page.goto('/');
  await setPin(page);
  await page.locator('#edText').waitFor();
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

export const storedRecord = page => page.evaluate(() => new Promise(res => {
  const r = indexedDB.open('jnotes'); r.onsuccess = () => { const q = r.result.transaction('kv').objectStore('kv').get('jnotes:v1'); q.onsuccess = () => res(q.result); };
}));
