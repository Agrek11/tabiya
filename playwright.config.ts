import { defineConfig, devices } from '@playwright/test';

const useWrangler = process.env.PLAYWRIGHT_SERVER === 'wrangler';
const port = useWrangler ? 8787 : 4173;

/** Set PLAYWRIGHT_SERVER=wrangler to exercise the deployed static-asset path. */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${port}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: useWrangler
      ? 'npm run build && npx wrangler dev --local --port 8787'
      : 'npm run build && npm run preview -- --port 4173',
    url: `http://localhost:${port}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
