/**
 * Type-discipline gate — Task 11.9 (Article 14, R9.8).
 *
 * Greps every Phase 4a source file for `: any` / `as any` / `<any>` and fails
 * unless the line (or the line above it) carries an `// any-ok:` justification.
 * Mechanical enforcement — TS strict already bans implicit any; this catches
 * the explicit escapes.
 */

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');

const PHASE_4A_GLOBS = [
  'src/engine',
  'src/coach',
  'src/components/coach',
  'src/hooks/useCoach.ts',
  'src/components/settings/AISection.tsx',
  'src/components/settings/EngineSection.tsx',
];

const ANY_RE = /(:\s*any\b|\bas\s+any\b|<any>)/;
const JUSTIFIED_RE = /\/\/\s*any-ok:/;

function collectFiles(entry: string): string[] {
  const abs = path.join(ROOT, entry);
  if (!fs.existsSync(abs)) return [];
  if (fs.statSync(abs).isFile()) return [abs];
  return fs
    .readdirSync(abs, { recursive: true, encoding: 'utf8' })
    .map((f) => path.join(abs, f))
    .filter((f) => /\.(ts|tsx)$/.test(f) && !f.endsWith('.d.ts') && fs.statSync(f).isFile());
}

describe('Article 14 — no bare `any` in Phase 4a files', () => {
  const files = PHASE_4A_GLOBS.flatMap(collectFiles);

  it('finds the 4a source files', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((f) => [path.relative(ROOT, f), f]))(
    '%s has no unjustified `any`',
    (_rel, abs) => {
      const lines = fs.readFileSync(abs, 'utf8').split('\n');
      const offenders = lines
        .map((line, i) => ({ line, i }))
        .filter(({ line }) => ANY_RE.test(line))
        .filter(({ line, i }) => !JUSTIFIED_RE.test(line) && !JUSTIFIED_RE.test(lines[i - 1] ?? ''))
        .map(({ line, i }) => `L${i + 1}: ${line.trim()}`);
      expect(offenders).toEqual([]);
    },
  );
});
