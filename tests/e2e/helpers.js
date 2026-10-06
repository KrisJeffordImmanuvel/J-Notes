export async function openFresh(page) {
  await page.goto('/');
  await page.getByRole('dialog', { name: 'Welcome to J Notes' }).waitFor();
  await page.keyboard.press('Escape');              // skip onboarding
  await page.getByRole('heading', { level: 1 }).waitFor();
}

/** Wait until the app reports that everything is saved. */
export async function waitSaved(page) {
  await page.locator('.js-status').first().filter({ hasText: /^Saved/ }).waitFor();
}
