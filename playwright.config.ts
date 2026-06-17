import { defineConfig, devices } from '@playwright/test';

/**
 * Cross-browser E2E (Phase: cross-browser test feature).
 *
 * Runs against `vite preview`, which serves the SAME COOP/COEP headers as the
 * dev server (vite.config.ts) so stockfish.wasm's SharedArrayBuffer is
 * available in-browser. Three engine families: Chromium, Firefox, WebKit
 * (Safari's engine). WebGPU (free Coach tier) is Chromium-only today — specs
 * that need it are tagged @webgpu and skipped elsewhere.
 *
 * Local: `npm run e2e` (build + preview + run). CI: same, headless.
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
