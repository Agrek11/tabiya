export type GameAnalysis = {
  gameId: string;
  enginePreset: string;
  createdAt: number;
  updatedAt: number;
  /**
   * Ordered ply snapshots; schema intentionally loose while Phase 5 matures.
   * Entries typically include cp-loss/mate-shift/meta derived from engine passes.
   */
  plies: Array<Record<string, unknown>>;
};

export type GameAnalysisKey = `${string}::${string}`;
