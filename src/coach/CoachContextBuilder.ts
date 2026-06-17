/**
 * CoachContextBuilder — assembles the 4a `CoachContext` (Task 7.2).
 *
 * Pure and deterministic: engine analysis + the last ≤6 plies + the preset
 * name. NO retrieval, NO opening KG, NO features — that is 4b–4d. The cap keeps
 * the prompt small and the cost predictable (R4.2, R4.3).
 */

import type { EngineAnalysis } from '../engine/ChessEngine';
import type { EnginePresetName } from '../engine/presets';
import type { CoachContext, PlyHistoryEntry } from './CoachContext';
import type { PositionFeatures } from './features/PositionFeatures';

export const MAX_HISTORY_PLIES = 6;

export type CoachContextInput = {
  engine: EngineAnalysis;
  /** Full ply history so far, oldest → newest. Truncated to the last 6. */
  history: PlyHistoryEntry[];
  enginePresetName: EnginePresetName;
  lineId?: string;
  plyIndex?: number;
  /** 4b — precomputed features for this position, or null when off-book. */
  features?: PositionFeatures | null;
};

export const CoachContextBuilder = {
  build(input: CoachContextInput): CoachContext {
    const history = input.history.slice(-MAX_HISTORY_PLIES);
    return {
      engine: input.engine,
      history,
      enginePresetName: input.enginePresetName,
      lineId: input.lineId,
      plyIndex: input.plyIndex,
      features: input.features ?? null,
    };
  },
};

/**
 * Helper: turn an ordered SAN list (the line played so far) into
 * `PlyHistoryEntry[]`. White moves first; ply 0 = White's first move.
 */
export function sansToHistory(sans: readonly string[]): PlyHistoryEntry[] {
  return sans.map((san, plyIndex) => ({
    san,
    plyIndex,
    color: plyIndex % 2 === 0 ? 'w' : 'b',
  }));
}
