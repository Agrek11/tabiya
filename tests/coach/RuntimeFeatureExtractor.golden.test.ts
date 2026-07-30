/**
 * Runtime extractor parity harness (Stage 1.2/1.3).
 *
 * Loads the full golden fixture corpus and enforces strict equality for the
 * deterministic feature set already implemented in the runtime extractor.
 * Remaining fixture families are registered as explicit TODO tests so parity
 * expansion progress is visible in one place.
 */

import { readFileSync } from 'node:fs';
import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { RuntimeFeatureExtractor } from '../../src/coach/features/RuntimeFeatureExtractor';

type GoldenDoc = {
  feature: string;
  positions: Array<{ name: string; fen: string; expected: unknown }>;
};

function dig(obj: unknown, dotted: string): unknown {
  let cur = obj as Record<string, unknown>;
  for (const part of dotted.split('.')) {
    cur = cur[part] as Record<string, unknown>;
  }
  return cur;
}

const GOLDEN_DIR = path.resolve(process.cwd(), 'evals', 'features', 'golden');
const fixtureDocs: GoldenDoc[] = readdirSync(GOLDEN_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(path.resolve(GOLDEN_DIR, name), 'utf8')) as GoldenDoc);

const STRICT_FEATURES = new Set([
  'material.balance_cp',
  'material.imbalance',
  'material.bishop_pair',
  'files_diagonals.open_files',
  'center_space.locked_center',
  'center_space.center_occupancy',
  'classification.center',
  'classification.structures',
  'pawns.doubled',
  'pawns.isolated',
  'pawns.passed',
  'pawns.candidate_passers',
  'pawns.backward',
  'pawns.islands',
  'pawns.chains',
  'pawns.majorities',
  'pawns.iqp',
  'pawns.hanging_duo',
  'king_safety.white',
  'king_safety.black',
  'files_diagonals.half_open',
  'files_diagonals.rook_on_seventh',
  'files_diagonals.long_diagonals',
  'activity.fianchetto',
  'activity.outposts',
  'activity.tempo',
  'activity.bad_bishop',
  'activity.trapped',
  'tactics_geometry.pins',
  'tactics_geometry.xrays',
  'tactics_geometry.overloaded',
  'tactics_geometry.discovered_candidates',
  'tactics_geometry.en_prise',
  'motifs.forks',
  'motifs.skewers',
  'motifs.batteries',
  'motifs.pins',
  'motifs.removing_defender',
  'motifs.hanging',
]);

describe('RuntimeFeatureExtractor parity (golden corpus)', () => {
  const fx = new RuntimeFeatureExtractor();

  for (const doc of fixtureDocs) {
    if (!STRICT_FEATURES.has(doc.feature)) {
      it.todo(`${doc.feature} :: parity fixture wired (strict assertion pending)`);
      continue;
    }
    for (const pos of doc.positions) {
      it(`${doc.feature} :: ${pos.name}`, async () => {
        const out = await fx.extract(pos.fen);
        expect(out).not.toBeNull();
        const actual = dig(out, doc.feature);
        expect(actual).toEqual(pos.expected);
      });
    }
  }
});
