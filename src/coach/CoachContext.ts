/**
 * CoachContext — the bundle handed to the narrator (Phase 4a, Design §2).
 *
 * 4a populates only `engine`, `history`, `enginePresetName`. The remaining
 * fields are forward-compatible placeholders for the symbolic moat layers
 * (4b features, 4c classification/motifs, 4d semantic tags/plan/KG). They are
 * typed `unknown` for now so adding them later is purely additive — no 4a
 * consumer breaks (R4.4, Article 5).
 */

import type { EngineAnalysis } from '../engine/ChessEngine';
import type { EnginePresetName } from '../engine/presets';
import type { PositionFeatures } from './features/PositionFeatures';

export type PlyHistoryEntry = {
  san: string;
  plyIndex: number;
  color: 'w' | 'b';
  userAction?: 'correct' | 'wrong' | 'hint';
  wrongAttempts?: string[];
};

export type CoachContext = {
  engine: EngineAnalysis;
  /** Last ≤6 plies, oldest → newest. */
  history: PlyHistoryEntry[];
  enginePresetName: EnginePresetName;
  lineId?: string;
  plyIndex?: number;

  // --- forward-compatible (typed in later sub-phases) ----------------------
  /** 4b — ~30 deterministic positional features (null = position not in the
   *  precomputed sidecar; narrator falls back to engine-only v1). */
  features?: PositionFeatures | null;
  /** 4c — open/closed, pawn-structure class, sharpness. */
  classification?: unknown;
  /** 4c — tactical + positional motifs. */
  motifs?: unknown;
  /** 4d — move-purpose taxonomy tags. */
  semanticTags?: unknown;
  /** 4d — multi-ply plan from deep-PV walk. */
  plan?: unknown;
  /** 4d — opening Knowledge-Graph node. */
  kgNode?: unknown;
};
