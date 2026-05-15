/**
 * Lazy loader + session cache for `public/transpositions.json`.
 *
 * Phase 2a artifact (built by `scripts/tabiya_build/transposition.py`),
 * consumed by Phase 2b's `useTransposition` hook. Article 11: the file is a
 * same-origin static asset, never a remote network call.
 *
 * Schema version check is strict — the loader throws on mismatch so the UI
 * doesn't silently render stale data when the algorithm changes (R5.2).
 */

import type { TranspositionSidecar } from '../types/keySquares';

/** Sidecar version this client knows how to consume. Bumps with the Python builder. */
export const TRANSPOSITION_SCHEMA_VERSION = 1;

/** Default sidecar path; tests can override via `setSidecarUrlForTesting`. */
const DEFAULT_SIDECAR_URL = '/transpositions.json';

let cached: TranspositionSidecar | null = null;
let inflight: Promise<TranspositionSidecar> | null = null;
let sidecarUrl: string = DEFAULT_SIDECAR_URL;

/**
 * Fetch + cache the transposition sidecar.
 *
 * Caching is process-lifetime (single-page-app session). On schema mismatch
 * throws a `RangeError` with the observed vs expected version so the caller
 * surfaces a clear diagnostic rather than rendering stale matches.
 */
export async function getTranspositionIndex(): Promise<TranspositionSidecar> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = (async () => {
    const res = await fetch(sidecarUrl);
    if (!res.ok) {
      throw new Error(
        `transpositions.json fetch failed: ${res.status} ${res.statusText}`,
      );
    }
    const data = (await res.json()) as TranspositionSidecar;
    if (data.schema_version !== TRANSPOSITION_SCHEMA_VERSION) {
      throw new RangeError(
        `transpositions.json schema_version=${data.schema_version} but ` +
          `client expects ${TRANSPOSITION_SCHEMA_VERSION}; rebuild the catalog`,
      );
    }
    cached = data;
    return data;
  })();
  try {
    return await inflight;
  } finally {
    inflight = null;
  }
}

/**
 * Drop the in-process cache.
 *
 * Hot-path callers should NOT use this — it's exposed for tests + dev tools.
 */
export function _resetTranspositionCacheForTesting(): void {
  cached = null;
  inflight = null;
  sidecarUrl = DEFAULT_SIDECAR_URL;
}

/** Test-only: override the sidecar URL (e.g. point at a local fixture). */
export function _setSidecarUrlForTesting(url: string): void {
  sidecarUrl = url;
  cached = null;
  inflight = null;
}
