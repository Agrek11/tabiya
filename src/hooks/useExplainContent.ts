/**
 * useExplainContent — Phase 1b lazy-loader for explain sidecars.
 *
 * Fetches `/explain/<lineId>.json` on demand and caches per `lineId` in
 * module-scope (survives SPA navigation, resets on hard reload). HTTP cache
 * handles cross-reload reuse — no localStorage caching layer.
 *
 * State machine:
 *
 *   idle        — `lineId === null`. No fetch issued.
 *   loading     — fetch in flight for `lineId`.
 *   loaded      — sidecar fetched and validated (block count matches moves).
 *   missing     — 404 OR length mismatch. Cache the verdict; treat as
 *                 graceful no-op (Article 5).
 *   error       — network / parse error. NOT cached; consumer may retry.
 *
 * Constitution:
 *   - Article 5 (repository pattern) — sidecar I/O is encapsulated here.
 *     Future migration to a backend-served sidecar endpoint is a one-hook swap.
 *   - Article 11 (local-first) — sidecars are static assets bundled with the
 *     app. No external network call.
 *   - Article 14 — strict TS, no `any`.
 */

import { useEffect, useState } from 'react';
import type { ExplainBlock } from '../storage/types';

export type ExplainContentState =
  | { kind: 'idle' }
  | { kind: 'loading'; lineId: string }
  | { kind: 'loaded'; lineId: string; data: ExplainBlock[] }
  | { kind: 'missing'; lineId: string }
  | { kind: 'error'; lineId: string; err: string };

type CacheEntry = ExplainBlock[] | 'missing';

const cache = new Map<string, CacheEntry>();

/** Test-only escape hatch — clears the in-module cache. */
export function _resetExplainContentCacheForTesting(): void {
  cache.clear();
}

/**
 * Validate raw JSON into `ExplainBlock[]`. Returns null if shape is wrong.
 * Strict-ish: tolerates unknown keys but requires `blocks: ExplainBlock[]`.
 */
function parseSidecar(raw: unknown): ExplainBlock[] | null {
  if (raw === null || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const blocks = obj.blocks;
  if (!Array.isArray(blocks)) return null;
  const out: ExplainBlock[] = [];
  for (const b of blocks) {
    if (b === null || typeof b !== 'object') return null;
    const block = b as Record<string, unknown>;
    if (typeof block.rationale !== 'string') return null;
    // arrows / highlights / threats / pauseMs are all optional. We accept
    // whatever shape the sidecar ships; the build validator already enforced
    // the schema. This is a runtime sanity check, not a re-validator.
    out.push(block as unknown as ExplainBlock);
  }
  return out;
}

export type UseExplainContentArgs = {
  lineId: string | null;
  /**
   * Optional expected ply count for runtime guard. When provided AND the
   * fetched blocks length differs, the result resolves to `missing` and
   * logs a console.warn. Build-time validation should have caught this.
   */
  expectedLength?: number;
  /**
   * Override fetch base for tests. Defaults to '/explain/'.
   */
  baseUrl?: string;
};

export function useExplainContent({
  lineId,
  expectedLength,
  baseUrl = '/explain/',
}: UseExplainContentArgs): ExplainContentState {
  const [state, setState] = useState<ExplainContentState>(() => {
    if (lineId === null) return { kind: 'idle' };
    const cached = cache.get(lineId);
    if (cached === 'missing') return { kind: 'missing', lineId };
    if (cached !== undefined) {
      if (expectedLength !== undefined && cached.length !== expectedLength) {
        return { kind: 'missing', lineId };
      }
      return { kind: 'loaded', lineId, data: cached };
    }
    return { kind: 'loading', lineId };
  });

  useEffect(() => {
    if (lineId === null) {
      setState({ kind: 'idle' });
      return;
    }
    const cached = cache.get(lineId);
    if (cached === 'missing') {
      setState({ kind: 'missing', lineId });
      return;
    }
    if (cached !== undefined) {
      if (expectedLength !== undefined && cached.length !== expectedLength) {
        // Stale catalog vs cached sidecar — treat as missing for safety.
        setState({ kind: 'missing', lineId });
        return;
      }
      setState({ kind: 'loaded', lineId, data: cached });
      return;
    }

    const controller = new AbortController();
    setState({ kind: 'loading', lineId });

    void (async () => {
      try {
        const resp = await fetch(`${baseUrl}${lineId}.json`, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        if (resp.status === 404) {
          cache.set(lineId, 'missing');
          setState({ kind: 'missing', lineId });
          return;
        }
        if (!resp.ok) {
          // Other HTTP error — do not cache; allow retry on next mount.
          setState({
            kind: 'error',
            lineId,
            err: `HTTP ${resp.status}`,
          });
          return;
        }
        const raw: unknown = await resp.json();
        const blocks = parseSidecar(raw);
        if (blocks === null) {
          // Shape failure — treat as missing (build-time check should catch).
          // eslint-disable-next-line no-console
          console.warn(`useExplainContent: sidecar shape invalid for ${lineId}`);
          cache.set(lineId, 'missing');
          setState({ kind: 'missing', lineId });
          return;
        }
        if (expectedLength !== undefined && blocks.length !== expectedLength) {
          // eslint-disable-next-line no-console
          console.warn(
            `useExplainContent: length mismatch for ${lineId} ` +
              `(blocks=${blocks.length}, expected=${expectedLength}); treating as missing.`,
          );
          cache.set(lineId, 'missing');
          setState({ kind: 'missing', lineId });
          return;
        }
        cache.set(lineId, blocks);
        setState({ kind: 'loaded', lineId, data: blocks });
      } catch (err) {
        if (controller.signal.aborted) return;
        const message = err instanceof Error ? err.message : String(err);
        // Network / parse error: NOT cached so a retry on next mount can recover.
        setState({ kind: 'error', lineId, err: message });
      }
    })();

    return () => {
      controller.abort();
    };
  }, [lineId, expectedLength, baseUrl]);

  return state;
}
