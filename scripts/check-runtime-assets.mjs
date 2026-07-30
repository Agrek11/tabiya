#!/usr/bin/env node
/** Verify the static files required by the browser-only production runtime. */
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const dist = path.join(root, 'dist');
const limit = 25 * 1024 * 1024; // Cloudflare Workers Static Assets file limit.
const required = [
  'index.html',
  'catalog.json',
  'features.json',
  'transpositions.json',
  'stockfish/stockfish.js',
  'stockfish/stockfish.wasm',
  'stockfish/stockfish.worker.js',
  'sounds/Move.mp3',
  '_headers',
];
const jsonFiles = ['catalog.json', 'features.json', 'transpositions.json'];
const failures = [];

if (!existsSync(dist)) failures.push('dist/ is missing; run npm run build first.');
for (const relative of required) {
  const file = path.join(dist, relative);
  if (!existsSync(file)) {
    failures.push(`Missing runtime asset: ${relative}`);
    continue;
  }
  const size = statSync(file).size;
  if (size === 0) failures.push(`Runtime asset is empty: ${relative}`);
  if (size > limit) failures.push(`Runtime asset exceeds Cloudflare's 25 MiB file limit: ${relative}`);
}
for (const relative of jsonFiles) {
  try {
    JSON.parse(readFileSync(path.join(dist, relative), 'utf8'));
  } catch {
    failures.push(`Invalid JSON runtime asset: ${relative}`);
  }
}

const html = existsSync(path.join(dist, 'index.html')) ? readFileSync(path.join(dist, 'index.html'), 'utf8') : '';
for (const source of [...html.matchAll(/(?:src|href)="\/?assets\/([^"?]+)/g)].map((match) => match[1])) {
  if (!existsSync(path.join(dist, 'assets', source))) failures.push(`index.html references a missing asset: assets/${source}`);
}
if (/\/workspaces\/|localhost:(?!11434)/.test(html)) failures.push('index.html contains a local filesystem or localhost production URL.');
if (/googleapis\.com|gstatic\.com/.test(html)) failures.push('index.html still requests Google Fonts.');

const forbidden = /(^|\/)(\.env(?:\..*)?|.*(?:token|credential|secret).*|.*\.(?:sqlite|db|trace))$/i;
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(file) : [path.relative(dist, file)];
});
for (const relative of existsSync(dist) ? walk(dist) : []) if (forbidden.test(relative)) failures.push(`Forbidden deployment artifact: ${relative}`);

if (failures.length) {
  console.error('Runtime asset verification failed:');
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
const largest = required
  .map((relative) => [relative, statSync(path.join(dist, relative)).size])
  .sort((a, b) => b[1] - a[1]);
console.log(`Runtime assets OK. Cloudflare per-file limit: 25 MiB. Largest required asset: ${largest[0][0]} (${largest[0][1]} bytes).`);
