/**
 * CompositeFeatureExtractor — sidecar-first, runtime-fallback orchestration.
 *
 * Resolution order (Phase 4c-runtime):
 * 1) Sidecar hash lookup (fast path for catalog positions)
 * 2) Runtime deterministic extraction (arbitrary FENs)
 * 3) null (caller degrades to engine-only prompt path)
 */

import type { FeatureExtractor } from './FeatureExtractor';
import type { PositionFeatures } from './PositionFeatures';

export class CompositeFeatureExtractor implements FeatureExtractor {
  private readonly primary: FeatureExtractor;
  private readonly fallback: FeatureExtractor;

  constructor(primary: FeatureExtractor, fallback: FeatureExtractor) {
    this.primary = primary;
    this.fallback = fallback;
  }

  async extract(fen: string): Promise<PositionFeatures | null> {
    try {
      const fromPrimary = await this.primary.extract(fen);
      if (fromPrimary) return fromPrimary;
    } catch {
      // degrade into fallback path
    }
    try {
      return await this.fallback.extract(fen);
    } catch {
      return null;
    }
  }
}
