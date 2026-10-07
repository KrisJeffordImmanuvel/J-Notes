import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.js/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /mobile\.spec\.js/ }
  ],
  webServer: {
    command: 'npm run build:all && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    // a test client ID so the Google sign-in UI is built in (Google itself is faked in the tests)
    env: { VITE_GOOGLE_CLIENT_ID: 'e2e-client.apps.googleusercontent.com' },
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});
