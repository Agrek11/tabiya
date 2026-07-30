import type { GameAnalysis } from '../types/analysis';

export type GhostCandidate = {
  gameId: string;
  plyIndex: number;
  playedSan: string;
  bestSan: string;
  cpLoss: number;
};

/**
 * Deterministic first-cut ghost selector:
 * - minimum cp-loss threshold
 * - keep earliest blunder in a local window to reduce noise
 */
export function selectGhostCandidates(
  analysis: GameAnalysis,
  opts?: { minCpLoss?: number; cooldownPlies?: number },
): GhostCandidate[] {
  const minCpLoss = opts?.minCpLoss ?? 120;
  const cooldown = opts?.cooldownPlies ?? 4;
  const out: GhostCandidate[] = [];
  let blockedUntil = -1;
  for (const raw of analysis.plies) {
    const ply = Number(raw.plyIndex);
    const cpLoss = Number(raw.cpLoss);
    const playedSan = String(raw.san ?? '');
    const bestSan = String(raw.bestmove ?? '');
    if (!Number.isFinite(ply) || !Number.isFinite(cpLoss)) continue;
    if (ply < blockedUntil) continue;
    if (cpLoss < minCpLoss) continue;
    out.push({
      gameId: analysis.gameId,
      plyIndex: ply,
      playedSan,
      bestSan,
      cpLoss,
    });
    blockedUntil = ply + cooldown;
  }
  return out;
}
