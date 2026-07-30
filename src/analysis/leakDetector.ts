import type { GameAnalysis } from '../types/analysis';

export type LeakScore = {
  key: string;
  games: number;
  mcl: number;
  flagged: boolean;
};

export function computeMcl(analysis: GameAnalysis): number {
  let sum = 0;
  let count = 0;
  for (const ply of analysis.plies) {
    const cpLoss = Number(ply.cpLoss);
    if (!Number.isFinite(cpLoss) || cpLoss <= 0) continue;
    sum += cpLoss;
    count += 1;
  }
  if (count === 0) return 0;
  return Math.round(sum / count);
}

export function detectLeaks(
  analyses: GameAnalysis[],
  keyOf: (a: GameAnalysis) => string,
  opts?: { minMcl?: number; minGames?: number },
): LeakScore[] {
  const minMcl = opts?.minMcl ?? 50;
  const minGames = opts?.minGames ?? 5;
  const buckets = new Map<string, { games: number; totalMcl: number }>();
  for (const a of analyses) {
    const key = keyOf(a);
    const cur = buckets.get(key) ?? { games: 0, totalMcl: 0 };
    cur.games += 1;
    cur.totalMcl += computeMcl(a);
    buckets.set(key, cur);
  }
  return [...buckets.entries()]
    .map(([key, v]) => {
      const mcl = Math.round(v.totalMcl / v.games);
      return {
        key,
        games: v.games,
        mcl,
        flagged: v.games >= minGames && mcl >= minMcl,
      };
    })
    .sort((a, b) => b.mcl - a.mcl);
}
