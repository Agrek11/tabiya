import type { GhostLineRecord } from '../types/ghost';

export type BlunderDnaCluster = {
  key: string;
  label: string;
  count: number;
  examples: string[];
};

function classifyPlayedMoveSan(playedSan: string, bestSan: string): string {
  if (/^[a-h](3|6|4|5)$/.test(playedSan)) return 'edge-or-wing-pawn-push';
  if (/^Q/.test(playedSan)) return 'early-queen-commit';
  if (bestSan === 'O-O' || bestSan === 'O-O-O') return 'missed-castling-window';
  if (playedSan.includes('x') && !bestSan.includes('x')) return 'speculative-capture';
  if (!playedSan.includes('x') && bestSan.includes('x')) return 'missed-tactical-capture';
  return 'general-calculation-slip';
}

function labelForKey(key: string): string {
  switch (key) {
    case 'edge-or-wing-pawn-push':
      return 'Edge/Wing Pawn Drift';
    case 'early-queen-commit':
      return 'Early Queen Commitment';
    case 'missed-castling-window':
      return 'Missed Castling Window';
    case 'speculative-capture':
      return 'Speculative Capture';
    case 'missed-tactical-capture':
      return 'Missed Tactical Capture';
    default:
      return 'General Calculation Slip';
  }
}

export function clusterGhostBlunders(ghosts: GhostLineRecord[]): BlunderDnaCluster[] {
  const buckets = new Map<string, { count: number; examples: string[] }>();
  for (const g of ghosts) {
    const played = g.forks[0]?.alternatives?.[0] ?? '';
    const best = g.moves[g.moves.length - 1] ?? '';
    const key = classifyPlayedMoveSan(played, best);
    const cur = buckets.get(key) ?? { count: 0, examples: [] };
    cur.count += 1;
    if (played) cur.examples.push(played);
    buckets.set(key, cur);
  }
  return [...buckets.entries()]
    .map(([key, v]) => ({
      key,
      label: labelForKey(key),
      count: v.count,
      examples: v.examples.slice(0, 3),
    }))
    .sort((a, b) => b.count - a.count);
}
