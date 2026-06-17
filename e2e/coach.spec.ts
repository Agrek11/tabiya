import { test, expect } from '@playwright/test';

/**
 * Coach engine path — opening the Why modal must produce the engine card from
 * the real in-browser Stockfish WASM (no LLM key configured → engine-only
 * degraded mode, which is the default). This is the cross-browser proof that
 * SharedArrayBuffer + the WASM worker load under the preview server's
 * COOP/COEP headers. WebKit/Firefox run it too — only WebGPU narration is
 * Chromium-bound, and we do not exercise that here.
 */

test('Why modal renders the engine card (engine-only degraded mode)', async ({ page }) => {
  await page.goto('/drill');

  const why = page.getByRole('button', { name: /why is this the best move/i });
  await why.waitFor({ state: 'visible', timeout: 15_000 });
  await why.click();

  // Engine card shows the best move line; allow time for a real WASM search.
  await expect(page.getByText(/Best:/)).toBeVisible({ timeout: 30_000 });

  // No LLM configured by default → degraded footer, not a narration card.
  await expect(page.getByTestId('coach-modal-degraded')).toBeVisible();
});
