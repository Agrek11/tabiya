/**
 * moveAnnotator — Explain Mode v2 deterministic per-ply rationale.
 *
 * Pure, grounded, hallucination-free: every clause is read off the real board
 * via chess.js (what piece moved, captures, castling, central pushes, the
 * concrete enemy pieces the move now attacks, check) and enriched with ONE
 * structural fact from the precomputed feature sidecar when it adds something
 * (a validated motif). No LLM, no engine, no authored content — works on any
 * catalog line for free.
 *
 * Replaces the Phase-1b GPT-batch sidecars (see
 * specs/phase-1b-explain-mode/requirements-v2-grounded.md).
 */

import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import type { ExplainBlock, Arrow, HighlightSquare } from '../../storage/types';
import type { PositionFeatures, Side } from '../features/PositionFeatures';

const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

const CENTRAL = new Set(['d4', 'e4', 'd5', 'e5']);
const WING_PUSH = new Set(['c4', 'c5', 'f4', 'f5']);

function moverSide(color: Color): Side {
  return color === 'w' ? 'white' : 'black';
}

/** "3. Nf3" for White, "3...Bc5" for Black (plyIndex is 0-based). */
function numberedSan(plyIndex: number, san: string): string {
  const moveNo = Math.floor(plyIndex / 2) + 1;
  return plyIndex % 2 === 0 ? `${moveNo}. ${san}` : `${moveNo}...${san}`;
}

/** Enemy pieces the piece now on `to` attacks (board is post-move). */
function attackedTargets(
  board: Chess,
  to: Square,
  moverColor: Color,
): Array<{ square: Square; piece: PieceSymbol }> {
  const enemy: Color = moverColor === 'w' ? 'b' : 'w';
  const out: Array<{ square: Square; piece: PieceSymbol }> = [];
  for (const row of board.board()) {
    for (const cell of row) {
      if (cell === null || cell.color !== enemy) continue;
      // `to` attacks this enemy square iff it shows up among its attackers.
      if (board.attackers(cell.square, moverColor).includes(to)) {
        out.push({ square: cell.square, piece: cell.type });
      }
    }
  }
  // Most valuable target first (knight/pawn distinction reads naturally).
  return out.sort((a, b) => PIECE_VALUE[b.piece] - PIECE_VALUE[a.piece]);
}

/** One structural enrichment clause from the sidecar, or null. Event-like only
 *  (motifs / IQP) — persistent facts like "fixed center" are skipped to avoid
 *  repeating the same line every ply. */
function enrichment(features: PositionFeatures | null, mover: Side): string | null {
  if (!features) return null;
  const m = features.motifs;
  if (m) {
    const fork = m.forks.find((f) => f.confidence === 'high');
    if (fork) return `${fork.by} forks ${fork.targets.join(' and ')}`;
    const pin = m.pins.find((p) => p.confidence === 'high');
    if (pin) return `${pin.by} pins ${pin.pinned} to the ${pin.to}`;
    const skewer = m.skewers.find((s) => s.confidence === 'high');
    if (skewer) return `${skewer.by} skewers ${skewer.front} and ${skewer.back}`;
  }
  if (features.pawns.iqp === mover) {
    return `it leaves ${mover} with an isolated queen's pawn to play around`;
  }
  return null;
}

export interface AnnotateArgs {
  /** FEN of the position BEFORE the move. */
  fenBefore: string;
  /** SAN of the move to explain. */
  san: string;
  /** 0-based ply index in the line. */
  plyIndex: number;
  /** Precomputed features for the position AFTER the move (sidecar hit), or null. */
  featuresAfter: PositionFeatures | null;
}

/**
 * Build one ExplainBlock for a ply. Returns a minimal block (numbered SAN only)
 * if the SAN is illegal from `fenBefore` (should not happen for catalog lines).
 */
export function annotateExplainPly(args: AnnotateArgs): ExplainBlock {
  const { fenBefore, san, plyIndex, featuresAfter } = args;
  const numbered = numberedSan(plyIndex, san);
  const board = new Chess(fenBefore);

  let mv;
  try {
    mv = board.move(san);
  } catch {
    return { rationale: `${numbered} — book move.` };
  }

  const mover = moverSide(mv.color);
  const piece = PIECE_NAME[mv.piece];
  const isCastle = mv.isKingsideCastle() || mv.isQueensideCastle();
  const clauses: string[] = [];

  // Primary intent.
  if (mv.isKingsideCastle()) {
    clauses.push('castles kingside, tucking the king away and activating the rook');
  } else if (mv.isQueensideCastle()) {
    clauses.push('castles queenside, king to safety and rook to the center');
  } else {
    const fromBackRank = mv.from[1] === (mv.color === 'w' ? '1' : '8');
    if ((mv.piece === 'n' || mv.piece === 'b') && fromBackRank) {
      clauses.push(`develops the ${piece}`);
    } else if (mv.piece === 'p' && CENTRAL.has(mv.to)) {
      clauses.push('stakes a claim in the center');
    } else if (mv.piece === 'p' && WING_PUSH.has(mv.to)) {
      clauses.push('grabs space on the wing');
    } else if (mv.piece === 'p') {
      clauses.push('advances the pawn');
    } else {
      clauses.push(`repositions the ${piece} to ${mv.to}`);
    }
  }

  // Capture.
  if (mv.captured) {
    clauses.push(`capturing the ${PIECE_NAME[mv.captured]} on ${mv.to}`);
  }

  // Concrete attacks created (skip if this move was itself a capture — the
  // capture clause already carries the point).
  if (!mv.captured && !isCastle) {
    const targets = attackedTargets(board, mv.to as Square, mv.color);
    const top = targets[0];
    if (top) {
      clauses.push(`attacking the ${PIECE_NAME[top.piece]} on ${top.square}`);
    }
  }

  if (board.isCheck()) clauses.push('with check');

  // Compose: "3. Nf3 — develops the knight, attacking the e5 pawn."
  let rationale = `${numbered} — ${joinClauses(clauses)}.`;
  const extra = enrichment(featuresAfter, mover);
  if (extra) rationale += ` ${capitalize(extra)}.`;

  // Overlays: green arrow for the move; focus the destination; flag attacked
  // enemy squares as threats (cap 2 to keep the board legible).
  const arrows: Arrow[] = [{ from: mv.from, to: mv.to, color: 'green' }];
  const highlights: HighlightSquare[] = [{ square: mv.to, intent: 'focus' }];
  if (!mv.captured && !isCastle) {
    for (const tgt of attackedTargets(board, mv.to as Square, mv.color).slice(0, 2)) {
      highlights.push({ square: tgt.square, intent: 'threat' });
    }
  }

  return { rationale, arrows, highlights };
}

function joinClauses(clauses: string[]): string {
  if (clauses.length <= 1) return clauses[0] ?? 'book move';
  if (clauses.length === 2) return `${clauses[0]}, ${clauses[1]}`;
  return `${clauses.slice(0, -1).join(', ')}, ${clauses[clauses.length - 1]}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
