#!/usr/bin/env node
/**
 * check-explain-size.js — Phase 1b R5 #5 build-size budget check.
 *
 * Sums gzip-compressed sizes of dist/assets/*.js after `vite build` and
 * compares against a committed baseline (scripts/explain-baseline.txt).
 * Asserts the delta is within the +12 KB gzip cap.
 *
 *   - delta > 12 KB             → exit 1 (fail)
 *   - delta > 9.6 KB (80% cap)  → warning, exit 0
 *   - --update-baseline         → rewrite baseline and exit 0
 *
 * Usage:
 *   node scripts/check-explain-size.js
 *   node scripts/check-explain-size.js --update-baseline
 */

import { promises as fs } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DIST_ASSETS = path.join(REPO_ROOT, 'dist', 'assets');
const BASELINE_FILE = path.join(__dirname, 'explain-baseline.txt');

const CAP_BYTES = 12 * 1024; // 12 KB gzip
const WARN_BYTES = Math.floor(CAP_BYTES * 0.8); // 9.6 KB

async function totalGzipBytes(dir) {
  const entries = await fs.readdir(dir);
  let total = 0;
  for (const entry of entries) {
    if (!entry.endsWith('.js')) continue;
    const raw = await fs.readFile(path.join(dir, entry));
    total += gzipSync(raw).length;
  }
  return total;
}

async function readBaseline() {
  try {
    const text = await fs.readFile(BASELINE_FILE, 'utf-8');
    const n = Number.parseInt(text.trim(), 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

async function writeBaseline(n) {
  await fs.writeFile(BASELINE_FILE, `${n}\n`, 'utf-8');
}

async function main() {
  const update = process.argv.includes('--update-baseline');

  try {
    await fs.stat(DIST_ASSETS);
  } catch {
    console.error(`error: ${DIST_ASSETS} does not exist. Run \`npm run build\` first.`);
    process.exit(2);
  }

  const total = await totalGzipBytes(DIST_ASSETS);
  console.log(`total gzip JS = ${total} bytes (${(total / 1024).toFixed(1)} KB)`);

  if (update) {
    await writeBaseline(total);
    console.log(`baseline updated → ${total} bytes`);
    return;
  }

  const baseline = await readBaseline();
  if (baseline === null) {
    console.warn(
      'no baseline yet. Run with --update-baseline once Phase 1b is in main to seed.',
    );
    return;
  }

  const delta = total - baseline;
  console.log(`baseline = ${baseline} bytes; delta = ${delta} bytes`);

  if (delta > CAP_BYTES) {
    console.error(`FAIL: delta ${delta} bytes exceeds cap ${CAP_BYTES} bytes (+12 KB).`);
    process.exit(1);
  }
  if (delta > WARN_BYTES) {
    console.warn(
      `WARN: delta ${delta} bytes is above the 80% threshold (${WARN_BYTES} bytes).`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
