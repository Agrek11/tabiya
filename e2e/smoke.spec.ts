import { test, expect } from '@playwright/test';

/**
 * Cross-browser smoke — runs on Chromium / Firefox / WebKit. Navigates by URL
 * (more stable than clicking the nav across engines) and asserts the core
 * surfaces render. No API keys, no network to Lichess/chess.com — these check
 * the app shell, routing, and local-first surfaces only.
 */

test('app boots and shows the dashboard', async ({ page }) => {
  await page.goto('/');
  // Dashboard mounts the out-of-book widget (disconnected empty state).
  await expect(page.getByText('Out-of-book moments')).toBeVisible();
});

test('drill page loads a board', async ({ page }) => {
  await page.goto('/drill');
  // react-chessboard renders 64 squares with data-square attributes.
  await expect(page.locator('[data-square]').first()).toBeVisible({ timeout: 15_000 });
});

test('coach Why button is present during a drill', async ({ page }) => {
  await page.goto('/drill');
  await expect(page.getByRole('button', { name: /why is this the best move/i })).toBeVisible({
    timeout: 15_000,
  });
});

test('settings shows all provider + sync sections', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByText('AI Coach')).toBeVisible();
  await expect(page.getByText('Lichess', { exact: true })).toBeVisible();
  await expect(page.getByText('Chess.com', { exact: true })).toBeVisible();
});

test('dashboard OOB widget shows the disconnected empty state', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText(/Connect Lichess or chess\.com/i)).toBeVisible();
});
