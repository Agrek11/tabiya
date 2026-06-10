/**
 * Bundle budget — Task 11.8 (R9.7, Article 11).
 *
 * Thin vitest wrapper around scripts/check-bundle-budget.mjs. A full
 * `vite build` is too slow for the default unit run, so the suite is gated:
 *
 *   BUNDLE_BUDGET=1 npm test -- --run tests/build
 *
 * or `npm run check:bundle` (build + script) — that is the CI gate.
 */

import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const gateEnabled = process.env.BUNDLE_BUDGET === '1';

describe.runIf(gateEnabled)('bundle budget gate', () => {
  it('build respects entry budget + lazy-chunk layout', () => {
    // vitest exports NODE_ENV=test; the gate must measure the real production
    // build, so pin it back.
    const env = { ...process.env, NODE_ENV: 'production' };
    execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'pipe', timeout: 300_000, env });
    const out = execFileSync('node', ['scripts/check-bundle-budget.mjs'], {
      cwd: ROOT,
      encoding: 'utf8',
      timeout: 60_000,
    });
    expect(out).toContain('Bundle budget OK.');
  }, 360_000);
});

describe.runIf(!gateEnabled)('bundle budget gate (skipped)', () => {
  it.skip('set BUNDLE_BUDGET=1 (or run `npm run check:bundle`) to enable', () => {});
});
