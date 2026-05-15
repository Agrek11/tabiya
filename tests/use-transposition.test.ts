/**
 * useTransposition (Phase 2b R8) — banner data hook tests.
 *
 * All cases use fixture loaders (no network). The current-FEN is hashed
 * via the real `fenHash` (Web Crypto) and the fixture index is keyed by
 * the same hash to mirror the runtime path end-to-end.
 *
 * Covers:
 *   - R8.6: ply 0 → no matches.
 *   - R8.7: empty repertoire → no matches.
 *   - active line filtered out of the result set.
 *   - R8.3: ≥4 matches → 3 returned + truncated = remainder.
 *   - sort determinism.
 *   - loader returns null (sidecar absent) → graceful empty result.
 *
 * Stability note: `pickedLineIds` (Set) and `lineNames` (Map) MUST be
 * defined outside the `renderHook` callback. The hook lists them as
 * useEffect deps for honest reactivity; re-creating the references on
 * each render would re-fire the effect, which would re-set state, which
 * would re-render, which would re-create the references — infinite
 * loop. The tests document this contract by passing stable values.
 */

import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  fenHash,
  useTransposition,
  __resetTranspositionCache,
  type TranspositionSidecar,
} from '../src/hooks/useTransposition';

afterEach(() => {
  cleanup();
});

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

async function buildSidecar(
  byFen: Record<string, string[]>
): Promise<TranspositionSidecar> {
  const index: Record<string, string[]> = {};
  for (const [fen, lineIds] of Object.entries(byFen)) {
    const h = await fenHash(fen);
    index[h] = lineIds;
  }
  return { schema_version: 2, index };
}

describe('useTransposition', () => {
  it('returns empty at ply 0 (R8.6)', async () => {
    __resetTranspositionCache();
    const sidecar = await buildSidecar({
      [STARTING_FEN]: ['line-a', 'line-b'],
    });
    const loadIndex = async () => sidecar;
    const picked = new Set(['line-a', 'line-b']);
    const lineNames = new Map<string, string>();
    const { result } = renderHook(() =>
      useTransposition({
        currentFen: STARTING_FEN,
        currentPly: 0,
        activeLineId: 'line-a',
        pickedLineIds: picked,
        lineNames,
        loadIndex,
      })
    );
    await waitFor(() => {
      expect(result.current.matches).toEqual([]);
      expect(result.current.truncated).toBe(0);
    });
  });

  it('returns empty when repertoire is empty (R8.7)', async () => {
    __resetTranspositionCache();
    const sidecar = await buildSidecar({
      [AFTER_E4]: ['line-a', 'line-b'],
    });
    const loadIndex = async () => sidecar;
    const picked = new Set<string>();
    const lineNames = new Map<string, string>();
    const { result } = renderHook(() =>
      useTransposition({
        currentFen: AFTER_E4,
        currentPly: 1,
        activeLineId: 'line-a',
        pickedLineIds: picked,
        lineNames,
        loadIndex,
      })
    );
    await waitFor(() => {
      expect(result.current.matches).toEqual([]);
    });
  });

  it('filters out the active line', async () => {
    __resetTranspositionCache();
    const sidecar = await buildSidecar({
      [AFTER_E4]: ['line-a', 'line-b'],
    });
    const loadIndex = async () => sidecar;
    const picked = new Set(['line-a', 'line-b']);
    const lineNames = new Map([['line-b', 'Line B']]);
    const { result } = renderHook(() =>
      useTransposition({
        currentFen: AFTER_E4,
        currentPly: 1,
        activeLineId: 'line-a',
        pickedLineIds: picked,
        lineNames,
        loadIndex,
      })
    );
    await waitFor(() => {
      expect(result.current.matches).toHaveLength(1);
      expect(result.current.matches[0]?.lineId).toBe('line-b');
      expect(result.current.matches[0]?.displayName).toBe('Line B');
    });
  });

  it('caps at 3 and reports the remainder (R8.3)', async () => {
    __resetTranspositionCache();
    const sidecar = await buildSidecar({
      [AFTER_E4]: ['line-z', 'line-y', 'line-x', 'line-w', 'line-v'],
    });
    const loadIndex = async () => sidecar;
    const picked = new Set([
      'line-z',
      'line-y',
      'line-x',
      'line-w',
      'line-v',
    ]);
    const lineNames = new Map<string, string>();
    const { result } = renderHook(() =>
      useTransposition({
        currentFen: AFTER_E4,
        currentPly: 1,
        activeLineId: 'line-active',
        pickedLineIds: picked,
        lineNames,
        loadIndex,
      })
    );
    await waitFor(() => {
      expect(result.current.matches).toHaveLength(3);
      // sort() is lexicographic — first three of v, w, x, y, z are v, w, x.
      expect(result.current.matches.map((m) => m.lineId)).toEqual([
        'line-v',
        'line-w',
        'line-x',
      ]);
      expect(result.current.truncated).toBe(2);
    });
  });

  it('falls back to lineId when displayName missing', async () => {
    __resetTranspositionCache();
    const sidecar = await buildSidecar({
      [AFTER_E4]: ['line-a', 'line-b'],
    });
    const loadIndex = async () => sidecar;
    const picked = new Set(['line-b']);
    const lineNames = new Map<string, string>();
    const { result } = renderHook(() =>
      useTransposition({
        currentFen: AFTER_E4,
        currentPly: 1,
        activeLineId: 'line-a',
        pickedLineIds: picked,
        lineNames,
        loadIndex,
      })
    );
    await waitFor(() => {
      expect(result.current.matches[0]?.displayName).toBe('line-b');
    });
  });

  it('handles a sidecar that is null (Phase 2a not landed yet)', async () => {
    __resetTranspositionCache();
    const loadIndex = async () => null;
    const picked = new Set(['line-a', 'line-b']);
    const lineNames = new Map<string, string>();
    const { result } = renderHook(() =>
      useTransposition({
        currentFen: AFTER_E4,
        currentPly: 1,
        activeLineId: 'line-a',
        pickedLineIds: picked,
        lineNames,
        loadIndex,
      })
    );
    await waitFor(() => {
      expect(result.current.matches).toEqual([]);
      expect(result.current.truncated).toBe(0);
    });
  });

  it('empty index entry → no matches', async () => {
    __resetTranspositionCache();
    const sidecar = await buildSidecar({});
    const loadIndex = async () => sidecar;
    const picked = new Set(['line-a', 'line-b']);
    const lineNames = new Map<string, string>();
    const { result } = renderHook(() =>
      useTransposition({
        currentFen: AFTER_E4,
        currentPly: 1,
        activeLineId: 'line-a',
        pickedLineIds: picked,
        lineNames,
        loadIndex,
      })
    );
    await waitFor(() => {
      expect(result.current.matches).toEqual([]);
    });
  });
});
