/**
 * useTransposition — Phase 2b transposition-banner data hook (R8).
 *
 * Given the current drill position, returns the set of OTHER picked-line
 * IDs that also reach this position. Drives the non-blocking banner above
 * the move history rail.
 *
 * Suppression rules:
 *   - R8.6: never at ply 0 (start position is shared by every line).
 *   - R8.7: never when the user's picked repertoire is empty.
 *   - The active line is filtered out of the match set.
 *
 * Cap (R8.3): at most 3 matches are returned; `truncated` carries the
 * count beyond the cap (`+N more`). Sort by lineId for determinism.
 *
 * Index loader contract:
 *   The hook calls a pluggable `loadIndex` function that returns a
 *   `TranspositionSidecar` (Phase 2a artifact). When Phase 2a has not
 *   shipped `public/transpositions.json` yet, callers can pass a
 *   fixture-backed loader. The hook caches the result for the session via
 *   a module-level closure (single fetch).
 *
 *   TODO(phase-2a): swap the default loader to import from
 *   `src/storage/transpositions.ts` once Phase 2a lands it. The current
 *   default does `fetch('/transpositions.json')` and 404-graceful-degrades
 *   so the hook is safe to ship before Phase 2a.
 *
 * Article 11 (local-first): the loader fetches a same-origin static
 *   asset (`/transpositions.json`) — no remote network.
 * Article 14 (type discipline): strict, no `any`.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeFen, fenHash } from '../chess/fenHash';

/**
 * Sidecar JSON shape — mirrors `scripts/tabiya_build/transposition.py`
 * output. CHOICE: declared locally in 2b so the hook ships independently
 * of Phase 2a's storage module. When Phase 2a's `src/storage/
 * transpositions.ts` lands, this type should be re-exported from there.
 */
export type TranspositionSidecar = {
  schema_version: number;
  generated_at?: string;
  fen_hash_algo?: string;
  fen_normalization?: string;
  index: Record<string, readonly string[]>;
};

export type TranspositionMatch = {
  lineId: string;
  displayName: string;
};

export interface UseTranspositionArgs {
  /** Current FEN on the drill board. */
  currentFen: string;
  /** Number of plies played from the start of the line. */
  currentPly: number;
  /** Active line ID — filtered out of matches. */
  activeLineId: string | null;
  /** Set of repertoire-picked line IDs (from useEffectivePick or RepertoirePick). */
  pickedLineIds: ReadonlySet<string>;
  /** Map lineId → display name (typically from catalog.lines). */
  lineNames: ReadonlyMap<string, string>;
  /**
   * Loader for the transposition sidecar. Override in tests to inject a
   * fixture without hitting the network. Defaults to a session-cached
   * fetch from `/transpositions.json` with 404 graceful-degrade.
   */
  loadIndex?: () => Promise<TranspositionSidecar | null>;
}

export interface UseTranspositionReturn {
  matches: TranspositionMatch[];
  /** Count of matches beyond the 3-cap (R8.3 `+N more`). */
  truncated: number;
}

const MATCH_CAP = 3;

// Module-level session cache for the default loader. Cleared on full
// page refresh (which is the only thing that would change the sidecar).
let cachedSidecar: TranspositionSidecar | null | undefined = undefined;

async function defaultLoadIndex(): Promise<TranspositionSidecar | null> {
  if (cachedSidecar !== undefined) return cachedSidecar;
  try {
    const res = await fetch('/transpositions.json');
    if (!res.ok) {
      cachedSidecar = null;
      return null;
    }
    const data = (await res.json()) as TranspositionSidecar;
    cachedSidecar = data;
    return data;
  } catch {
    cachedSidecar = null;
    return null;
  }
}

/** Test-only: reset the module-level loader cache. */
export function __resetTranspositionCache(): void {
  cachedSidecar = undefined;
}

export function useTransposition({
  currentFen,
  currentPly,
  activeLineId,
  pickedLineIds,
  lineNames,
  loadIndex = defaultLoadIndex,
}: UseTranspositionArgs): UseTranspositionReturn {
  const [matches, setMatches] = useState<TranspositionMatch[]>([]);
  const [truncated, setTruncated] = useState<number>(0);

  // Hold the latest references in refs so the effect can read them WITHOUT
  // listing them in the dep array. Set/Map identities routinely change on
  // every parent render — listing them as deps would re-fire the effect
  // every render, set state, re-render, infinite loop. Instead, the effect
  // re-runs on a stable string snapshot of the picks (Article 14: explicit
  // and deterministic).
  const pickedRef = useRef<ReadonlySet<string>>(pickedLineIds);
  const namesRef = useRef<ReadonlyMap<string, string>>(lineNames);
  const loadRef = useRef<() => Promise<TranspositionSidecar | null>>(loadIndex);
  useEffect(() => {
    pickedRef.current = pickedLineIds;
    namesRef.current = lineNames;
    loadRef.current = loadIndex;
  });

  // Sorted, joined string of picked IDs — stable across renders that don't
  // actually mutate the set.
  const picksKey = useMemo(
    () => [...pickedLineIds].sort().join(','),
    [pickedLineIds],
  );

  useEffect(() => {
    let cancelled = false;

    // R8.6 / R8.7 — suppress before any lookup.
    if (
      currentPly === 0 ||
      pickedRef.current.size === 0 ||
      activeLineId === null
    ) {
      setMatches([]);
      setTruncated(0);
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const sidecar = await loadRef.current();
      if (cancelled) return;
      if (sidecar === null) {
        setMatches([]);
        setTruncated(0);
        return;
      }
      const hash = await fenHash(currentFen);
      if (cancelled) return;
      const lineIds = sidecar.index[hash] ?? [];
      const filtered = lineIds
        .filter((id) => id !== activeLineId && pickedRef.current.has(id))
        .sort(); // R8.3 deterministic
      const capped = filtered.slice(0, MATCH_CAP);
      const next: TranspositionMatch[] = capped.map((id) => ({
        lineId: id,
        displayName: namesRef.current.get(id) ?? id,
      }));
      setMatches(next);
      setTruncated(Math.max(0, filtered.length - MATCH_CAP));
    })();

    return () => {
      cancelled = true;
    };
  }, [currentFen, currentPly, activeLineId, picksKey]);

  return { matches, truncated };
}

// Re-export the FEN helpers so tests can compose fixtures without import cycles.
export { normalizeFen, fenHash };
