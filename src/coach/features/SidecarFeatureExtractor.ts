/**
 * SidecarFeatureExtractor — Phase 4b runtime consumer of `public/features.json`.
 *
 * Lazy-fetches the sidecar once (mirrors `storage/transpositions.ts`), then
 * answers `extract(fen)` by hashing the FEN with the shared Phase 2
 * normalized-FEN sha1-16 and looking it up. Unknown position → null (off-book
 * games hit this until the 4d runtime extractor lands). Schema-version
 * mismatch or fetch failure → null on every call (degrade, never throw).
 */

import { fenHash } from '../../chess/fenHash';
import type { FeatureExtractor } from './FeatureExtractor';
import {
  FEATURES_SCHEMA_VERSION,
  type FeaturesSidecar,
  type PositionFeatures,
} from './PositionFeatures';

const DEFAULT_URL = '/features.json';

let sidecarUrl = DEFAULT_URL;
let cached: FeaturesSidecar | null = null;
let inflight: Promise<FeaturesSidecar | null> | null = null;

async function loadSidecar(): Promise<FeaturesSidecar | null> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch(sidecarUrl);
      if (!res.ok) return null;
      const data = (await res.json()) as FeaturesSidecar;
      if (data.schema_version !== FEATURES_SCHEMA_VERSION) {
        if (import.meta.env.DEV) {
          console.warn(
            `[coach] features.json schema_version=${data.schema_version} ` +
              `but client expects ${FEATURES_SCHEMA_VERSION}; degrading to engine-only`,
          );
        }
        return null;
      }
      cached = data;
      return data;
    } catch {
      return null; // offline / missing sidecar → degrade (Article 11)
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export class SidecarFeatureExtractor implements FeatureExtractor {
  async extract(fen: string): Promise<PositionFeatures | null> {
    const sidecar = await loadSidecar();
    if (!sidecar) return null;
    const hash = await fenHash(fen);
    return sidecar.index[hash] ?? null;
  }
}

/** Test-only: point the loader at a fixture URL and drop the cache. */
export function _setFeaturesSidecarUrlForTesting(url: string): void {
  sidecarUrl = url;
  cached = null;
  inflight = null;
}

/** Test-only: reset to defaults. */
export function _resetFeaturesSidecarForTesting(): void {
  sidecarUrl = DEFAULT_URL;
  cached = null;
  inflight = null;
}
