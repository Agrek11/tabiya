import type { GameAnalysis } from '../types/analysis';
import type { GhostLineRecord } from '../types/ghost';
import type { GhostCandidate } from './ghostCandidates';

export type GhostLine = GhostLineRecord;

function deterministicGhostId(
  gameId: string,
  plyIndex: number,
  parentLineId: string | null,
): string {
  return `ghost:${parentLineId ?? 'none'}:${gameId}:${plyIndex}`;
}

/**
 * Synthesize a deterministic drillable line from a ghost candidate.
 *
 * The line is anchored to game history up to the candidate ply, then replaces
 * the played move with the engine-best move and carries the played move as a
 * fork annotation ("you played X").
 */
export function synthesizeGhostLine(
  analysis: GameAnalysis,
  candidate: GhostCandidate,
  opts?: { parentLineId?: string | null },
): GhostLine {
  const parentLineId = opts?.parentLineId ?? null;
  const id = deterministicGhostId(analysis.gameId, candidate.plyIndex, parentLineId);
  const orderedPlies = [...analysis.plies]
    .map((raw) => ({
      plyIndex: Number(raw.plyIndex),
      san: String(raw.san ?? ''),
      fenAfter: String(raw.fenAfter ?? ''),
    }))
    .filter((x) => Number.isFinite(x.plyIndex) && x.san.length > 0)
    .sort((a, b) => a.plyIndex - b.plyIndex);
  const historySans = orderedPlies
    .filter((p) => p.plyIndex < candidate.plyIndex)
    .map((p) => p.san);
  const moves = [...historySans, candidate.bestSan];
  const endFen = orderedPlies.find((p) => p.plyIndex === candidate.plyIndex)?.fenAfter ?? '';

  return {
    source: 'ghost',
    game_id: analysis.gameId,
    origin_ply: candidate.plyIndex,
    parent_line_id: parentLineId,
    created_at: Date.now(),
    cp_loss: candidate.cpLoss,
    id,
    opening_id: 'ghost',
    variation_id: 'ghost',
    name: `Ghost Fix • ply ${candidate.plyIndex + 1}`,
    moves,
    depth: moves.length,
    end_fen: endFen,
    popularity: 0,
    tags: ['ghost-line', 'from-your-games'],
    strategic_notes: [
      `From game ${analysis.gameId}, ply ${candidate.plyIndex + 1}.`,
      `Played ${candidate.playedSan}; best move ${candidate.bestSan}.`,
    ],
    key_squares: [],
    forks: [
      {
        ply_index: historySans.length,
        alternatives: [candidate.playedSan],
        label: 'You played this in your game',
        rationale: `Engine prefers ${candidate.bestSan} (${candidate.cpLoss} cp swing).`,
      },
    ],
  };
}
