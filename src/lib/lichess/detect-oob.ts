/**
 * Out-of-book detection — Phase 3 R5 (linear) + R6 (transposition-aware).
 *
 * Pure function over (game, pickedLines, optional transposition index):
 * walks the game ply-by-ply, tracking which picked lines are still "alive"
 * (every prior ply matched). The first user-color move matching no alive line
 * is the OOB moment. Opponent moves never produce events (R5 AC9) but do
 * prune lines — if the opponent leaves the user's prep, detection ends with
 * no event.
 *
 * Determinism (R5 AC10): expectedSANs sorted; lineId attribution = deepest
 * alive line, lex tiebreak on id; the only timestamp is `detectedAt` at
 * emission (injectable for tests).
 *
 * Transpositions (R6) — GRACE WALK. The spec'd "check only the position after
 * the diverging move" can almost never rescue a real transposition: move-order
 * swaps converge one to three plies AFTER the first textual divergence (the
 * requirements' own Caro-Kann/Slav example: 1.d4 c6 2.e4 d5 diverges at ply 0
 * but converges with 1.e4 c6 2.d4 d5 only after ply 2). So when alive empties
 * and the Phase 2 index is present, the walk continues for up to GRACE_PLIES,
 * hashing the position after each ply (sha1-16 over drop-counters
 * normalization) and querying the sidecar. A hit on a picked line switches
 * alive tracking to that line at the matching depth — in book, no event. If
 * the window expires: the original user-move divergence event is emitted
 * (opponent-move divergence stays a no-event outcome). Absent index = pure
 * linear walk (graceful degrade, R6 AC4).
 */

import { Chess } from 'chess.js';
import { fenHash } from '../../chess/fenHash';
import type { TranspositionSidecar } from '../../types/keySquares';
import type { LichessGame, OOBEvent, PickedLine } from './types';

/** Max plies past the first divergence to look for a transposition. */
export const GRACE_PLIES = 4;

/**
 * Divergences at move 1 (plyIndex 0 or 1) are noise — they just mean the user
 * opened with a different first move than their prep, not that they left a line
 * mid-theory. Suppress them; only emit for divergences at move 2+ (plyIndex ≥ 2).
 */
export const MIN_OOB_PLY = 2;

export interface DetectInput {
  game: LichessGame;
  /** Picked repertoire lifted to detector shape; the detector filters to the
   *  game's user color itself. */
  pickedLines: PickedLine[];
  /** Phase 2 sidecar; null/undefined = linear-only walk (R6 AC4). */
  transpositionIndex?: TranspositionSidecar | null;
  /** Injectable clock for deterministic golden tests. */
  now?: () => number;
}

type Alive = { line: PickedLine; depth: number };

function pickDeepest(alive: Alive[]): Alive | null {
  return (
    [...alive].sort((a, b) => b.depth - a.depth || a.line.id.localeCompare(b.line.id))[0] ?? null
  );
}

/**
 * Ply depth at which `line` reaches the position with hash `targetHash`,
 * or null. Cheap: lines are ≤20 plies (Article 8 cap).
 */
async function depthReachingHash(line: PickedLine, targetHash: string): Promise<number | null> {
  const board = new Chess();
  for (let d = 0; d < line.plies.length; d++) {
    try {
      board.move(line.plies[d]!);
    } catch {
      return null; // malformed line data — treat as unreachable
    }
    if ((await fenHash(board.fen())) === targetHash) return d + 1;
  }
  return null;
}

/**
 * Query the sidecar for picked lines reaching `board`'s current position.
 * `consumed` = the position is some picked line's FINAL position (the game
 * transposed into the end of book — in-book outcome). `alive` = lines with
 * plies remaining, as entries at the matching depth (sorted line id).
 */
async function transposedAlive(
  board: Chess,
  index: TranspositionSidecar,
  pickedById: Map<string, PickedLine>,
): Promise<{ alive: Alive[]; consumed: boolean }> {
  const hash = await fenHash(board.fen());
  const ids = (index.index[hash] ?? []).filter((id) => pickedById.has(id)).sort();
  const alive: Alive[] = [];
  let consumed = false;
  for (const id of ids) {
    const line = pickedById.get(id)!;
    const depth = await depthReachingHash(line, hash);
    if (depth === null) continue;
    if (depth >= line.plies.length) consumed = true;
    else alive.push({ line, depth });
  }
  return { alive, consumed };
}

export async function detectOOB(input: DetectInput): Promise<OOBEvent | null> {
  const { game, transpositionIndex } = input;
  const now = input.now ?? Date.now;
  const userColor = game.userColor;
  const candidates = input.pickedLines.filter((l) => l.color === userColor);
  if (candidates.length === 0) return null; // no prep for this color (R5 AC3)

  // PGN → SAN plies; malformed PGN is the caller's failure mode.
  const parser = new Chess();
  parser.loadPgn(game.pgn);
  const plies = parser.history();

  const pickedById = new Map(candidates.map((l) => [l.id, l]));
  const board = new Chess();
  let alive: Alive[] = candidates.map((line) => ({ line, depth: 0 }));

  for (let i = 0; i < plies.length; i++) {
    const playedSan = plies[i]!;
    const movedColor = i % 2 === 0 ? 'white' : 'black';
    const isUserMove = movedColor === userColor;

    const matching = alive.filter((a) => a.line.plies[a.depth] === playedSan);

    if (matching.length > 0) {
      alive = matching.map((a) => ({ line: a.line, depth: a.depth + 1 }));
      board.move(playedSan);
      if (alive.every((a) => a.depth >= a.line.plies.length)) {
        return null; // book fully consumed — stayed in prep end-to-end (R5 AC7)
      }
      continue;
    }

    // Divergence. Build the event NOW (pre-divergence alive set, R5 AC6) —
    // emitted only if it was a user move at move 2+ (move-1 divergences are
    // noise, MIN_OOB_PLY) and no transposition rescues it.
    const event: OOBEvent | null =
      isUserMove && i >= MIN_OOB_PLY
        ? {
          gameId: game.id,
          plyIndex: i,
          playedSAN: playedSan,
          expectedSANs: [
            ...new Set(
              alive
                .map((a) => a.line.plies[a.depth])
                .filter((s): s is string => s !== undefined),
            ),
          ].sort(),
          color: userColor,
          fenAtOOB: board.fen(),
          openingEco: game.opening?.eco ?? null,
          openingName: game.opening?.name ?? null,
          lineId: pickDeepest(alive)?.line.id ?? null,
          detectedAt: now(),
        }
      : null; // opponent left book — never an event (R5 AC9)

    if (!transpositionIndex) return event;

    // R6 grace walk — play forward up to GRACE_PLIES looking for convergence
    // into any picked line by position.
    const graceEnd = Math.min(i + GRACE_PLIES, plies.length - 1);
    for (let j = i; j <= graceEnd; j++) {
      board.move(plies[j]!);
      const { alive: switched, consumed } = await transposedAlive(
        board,
        transpositionIndex,
        pickedById,
      );
      if (consumed && switched.length === 0) {
        return null; // transposed into the END of a picked line — in book
      }
      if (switched.length > 0) {
        alive = switched;
        i = j; // resume the main walk after the convergence ply
        break;
      }
      if (j === graceEnd) return event; // window expired — divergence stands
    }
  }
  return null; // game ended before leaving book (R5 AC7)
}
