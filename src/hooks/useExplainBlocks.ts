/**
 * useExplainBlocks — Explain Mode v2 content hook.
 *
 * Generates grounded per-ply ExplainBlocks at runtime for the active line
 * (move semantics + precomputed feature enrichment). Replaces the old per-line
 * authored-sidecar fetch path: every catalog line is covered,
 * no network round-trip beyond the one-time features sidecar load.
 *
 * Returns blocks ONLY when they correspond to the current line (avoids a stale
 * flash while the next line generates). Empty array = not ready / no line.
 */

import { useEffect, useState } from 'react';
import type { ExplainBlock, Line } from '../storage/types';
import { generateExplainBlocks } from '../coach/explain/generateExplainBlocks';
import { SidecarFeatureExtractor } from '../coach/features/SidecarFeatureExtractor';

const extractor = new SidecarFeatureExtractor();

export function useExplainBlocks(line: Line | null): ExplainBlock[] {
  const [state, setState] = useState<{ lineId: string; blocks: ExplainBlock[] } | null>(null);

  useEffect(() => {
    if (line === null) return; // return guard below yields [] for no line
    let cancelled = false;
    void generateExplainBlocks(line.moves, extractor).then((blocks) => {
      if (!cancelled) setState({ lineId: line.id, blocks });
    });
    return () => {
      cancelled = true;
    };
  }, [line]);

  return line !== null && state?.lineId === line.id ? state.blocks : [];
}
