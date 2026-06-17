/**
 * FeatureExtractor — the Article 5 seam for positional features (Phase 4b).
 *
 * The Coach pipeline depends on THIS interface, never a concrete source. 4b
 * ships `SidecarFeatureExtractor` (precomputed catalog lookup); 4d/4e add a
 * runtime extractor for arbitrary (off-book) FENs behind the same surface.
 * `extract` returns null for an unknown position — the caller degrades to the
 * engine-only prompt (Article 11), never errors.
 */

import type { PositionFeatures } from './PositionFeatures';

export interface FeatureExtractor {
  extract(fen: string): Promise<PositionFeatures | null>;
}
