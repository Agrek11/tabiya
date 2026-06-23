/**
 * generateExplainBlocks — Explain Mode v2 runtime generation.
 *
 * Walks a line ply-by-ply and produces one grounded ExplainBlock per move via
 * `annotateExplainPly`, enriching each with the precomputed features for the
 * resulting position (sidecar hit) when available. Pure w.r.t. React; the only
 * async is the feature extractor's one-time sidecar fetch.
 *
 * This replaces the Phase-1b authored JSON sidecars: no fetch-per-line, no
 * authored content, every catalog line covered.
 */

import { Chess } from 'chess.js';
import type { ExplainBlock } from '../../storage/types';
import type { FeatureExtractor } from '../features/FeatureExtractor';
import type { PositionFeatures } from '../features/PositionFeatures';
import { annotateExplainPly } from './moveAnnotator';

export async function generateExplainBlocks(
  moves: readonly string[],
  extractor: FeatureExtractor,
): Promise<ExplainBlock[]> {
  const board = new Chess();
  const blocks: ExplainBlock[] = [];
  for (let i = 0; i < moves.length; i++) {
    const san = moves[i]!;
    const fenBefore = board.fen();
    try {
      board.move(san);
    } catch {
      // Malformed line data — emit a minimal block and stop enriching forward.
      blocks.push(annotateExplainPly({ fenBefore, san, plyIndex: i, featuresAfter: null }));
      continue;
    }
    let featuresAfter: PositionFeatures | null = null;
    try {
      featuresAfter = await extractor.extract(board.fen());
    } catch {
      // degrade to move-semantics only (Article 11) — featuresAfter stays null
    }
    blocks.push(annotateExplainPly({ fenBefore, san, plyIndex: i, featuresAfter }));
  }
  return blocks;
}
