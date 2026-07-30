#!/usr/bin/env node
/**
 * Bundle budget gate — Task 11.8 (R9.7, Article 11).
 *
 * Asserts on a built `dist/`:
 *   1. The entry chunk gzip size stays ≤ BASELINE + BUDGET. `main` was
 *      unbuildable pre-4a (tsc -b was red), so the baseline is the gzip size
 *      recorded at 4a completion; re-baseline deliberately, in a reviewed
 *      commit, when the app legitimately grows.
 *   2. stockfish code is NOT in the entry chunk — the engine loads as its own
 *      lazy chunk (worker file + StockfishWasmEngine chunk both exist).
 *   3. Neither LLM SDK (@anthropic-ai/sdk, openai) is in the entry chunk —
 *      both live in dynamic-import-only chunks.
 *
 * Usage: node scripts/check-bundle-budget.mjs   (after `npm run build`)
 * Exits non-zero on any violation.
 */

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import path from 'node:path';

// gzip bytes of dist/assets/index-*.js recorded 2026-06-10 at 4a completion.
const ENTRY_GZIP_BASELINE = 157_000;
// R9.7 — allowed growth before the gate trips.
const BUDGET_BYTES = 31_000;

const ROOT = path.resolve(import.meta.dirname, '..');
const ASSETS = path.join(ROOT, 'dist', 'assets');

if (!existsSync(ASSETS)) {
  console.error('dist/assets not found — run `npm run build` first.');
  process.exit(2);
}

const files = readdirSync(ASSETS);
const jsChunks = files.filter((f) => f.endsWith('.js'));
const entryName = jsChunks.find((f) => /^index-.*\.js$/.test(f));

const failures = [];

if (!entryName) {
  failures.push('No entry chunk (index-*.js) found in dist/assets.');
} else {
  const entry = readFileSync(path.join(ASSETS, entryName), 'utf8');
  const entryGzip = gzipSync(Buffer.from(entry)).length;

  // 1 — size budget
  const ceiling = ENTRY_GZIP_BASELINE + BUDGET_BYTES;
  console.log(`entry ${entryName}: gzip ${entryGzip} B (ceiling ${ceiling} B)`);
  if (entryGzip > ceiling) {
    failures.push(
      `Entry chunk gzip ${entryGzip} B exceeds ceiling ${ceiling} B ` +
        `(baseline ${ENTRY_GZIP_BASELINE} + budget ${BUDGET_BYTES}).`,
    );
  }

  // 2 — stockfish stays lazy. "stockfish" as a substring is legal in the entry
  // (dynamic-import path string, Settings copy); actual engine/worker code is
  // fingerprinted by UCI protocol strings, which live only in the worker
  // (Article 9 — UCI never escapes it).
  if (/uciok|setoption name|go depth |position fen /.test(entry)) {
    failures.push('Entry chunk contains UCI protocol strings — engine code must stay in its lazy chunk.');
  }
  if (!jsChunks.some((f) => /stockfish-worker/.test(f))) {
    failures.push('No stockfish-worker chunk emitted — worker split is broken.');
  }
  if (!jsChunks.some((f) => /StockfishWasmEngine/.test(f))) {
    failures.push('No StockfishWasmEngine chunk emitted — engine lazy-load split is broken.');
  }

  // 3 — LLM SDKs stay in dynamic-import-only chunks
  // Fingerprints that only appear inside the SDK bodies, never in our wrappers.
  const sdkFingerprints = [
    ['@anthropic-ai/sdk', /anthropic-version/],
    ['openai', /api\.openai\.com/],
  ];
  for (const [name, re] of sdkFingerprints) {
    if (re.test(entry)) {
      failures.push(`Entry chunk contains ${name} SDK code — must be dynamic-import only.`);
    }
    if (!jsChunks.some((f) => f !== entryName && re.test(readFileSync(path.join(ASSETS, f), 'utf8')))) {
      failures.push(`${name} SDK chunk not found among lazy chunks.`);
    }
  }
}

if (failures.length > 0) {
  console.error('\nBundle budget FAILED:');
  for (const f of failures) console.error(`  ✕ ${f}`);
  process.exit(1);
}
console.log('Bundle budget OK.');
