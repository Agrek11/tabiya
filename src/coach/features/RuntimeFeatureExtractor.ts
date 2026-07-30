/**
 * RuntimeFeatureExtractor — Phase 4c-runtime fallback for arbitrary FENs.
 *
 * This extractor computes a deterministic, lightweight `PositionFeatures`
 * object directly in the browser from a FEN when the catalog sidecar has no
 * hash hit (off-book/game-review positions).
 *
 * Design intent:
 * - never throw (Article 11): invalid/unsupported positions return null
 * - deterministic for the same FEN
 * - keep logic local and dependency-light (chess.js only)
 */

import { Chess, type PieceSymbol, type Square } from 'chess.js';
import type {
  ActivityFeatures,
  CenterType,
  ClassificationFeatures,
  FeaturesSidecar,
  FilesDiagonalsFeatures,
  KingSafetySide,
  MotifFeatures,
  OutpostSide,
  PawnFeatures,
  PerSide,
  PositionFeatures,
  Side,
  TacticsGeometryFeatures,
} from './PositionFeatures';
import type { FeatureExtractor } from './FeatureExtractor';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const CENTRAL_SQUARES: Square[] = ['d4', 'e4', 'd5', 'e5'];
const START_MINOR_WHITE = new Set(['b1', 'g1', 'c1', 'f1']);
const START_MINOR_BLACK = new Set(['b8', 'g8', 'c8', 'f8']);
const RUNTIME_EXTRACTOR_VERSION = 6;

type BoardPiece = { square: Square; color: Side; type: PieceSymbol };

function toSide(color: 'w' | 'b'): Side {
  return color === 'w' ? 'white' : 'black';
}

function opponent(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

function rankOf(square: Square): number {
  return Number(square[1]);
}

function fileOf(square: Square): string {
  return square.charAt(0);
}

function fileIndex(file: string): number {
  return FILES.indexOf(file as (typeof FILES)[number]);
}

/** Match python-chess's deterministic square ordering: a1 through h8. */
function compareSquares(a: string, b: string): number {
  return rankOf(a as Square) - rankOf(b as Square) || fileIndex(fileOf(a as Square)) - fileIndex(fileOf(b as Square));
}

function adjacentFiles(file: string): string[] {
  const i = fileIndex(file);
  const out: string[] = [];
  if (i > 0) {
    const prev = FILES[i - 1];
    if (prev) out.push(prev);
  }
  if (i < FILES.length - 1) {
    const next = FILES[i + 1];
    if (next) out.push(next);
  }
  return out;
}

function collectPieces(board: Chess): BoardPiece[] {
  const out: BoardPiece[] = [];
  const rows = board.board();
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row) continue;
    for (let f = 0; f < row.length; f += 1) {
      const piece = row[f];
      if (!piece) continue;
      const square = `${FILES[f]}${8 - r}` as Square;
      out.push({ square, color: toSide(piece.color), type: piece.type });
    }
  }
  return out;
}

function materialCp(pieces: BoardPiece[]): number {
  const val: Record<PieceSymbol, number> = { p: 100, n: 300, b: 300, r: 500, q: 900, k: 0 };
  let score = 0;
  for (const p of pieces) score += (p.color === 'white' ? 1 : -1) * val[p.type];
  return score;
}

function describeImbalanceFromPieces(pieces: BoardPiece[]): string {
  const count = (side: Side, type: PieceSymbol): number =>
    pieces.filter((p) => p.color === side && p.type === type).length;
  const diff = {
    b: count('white', 'b') - count('black', 'b'),
    n: count('white', 'n') - count('black', 'n'),
    r: count('white', 'r') - count('black', 'r'),
    q: count('white', 'q') - count('black', 'q'),
  };
  const labels = { b: 'B', n: 'N', r: 'R', q: 'Q' } as const;
  const whiteExtras: string[] = [];
  const blackExtras: string[] = [];
  for (const t of ['q', 'r', 'b', 'n'] as const) {
    if (diff[t] > 0) whiteExtras.push(...Array(diff[t]).fill(labels[t]));
    if (diff[t] < 0) blackExtras.push(...Array(-diff[t]).fill(labels[t]));
  }
  if (whiteExtras.length === 0 && blackExtras.length === 0) return 'none';
  const left = whiteExtras.join('+') || 'none';
  const right = blackExtras.join('+') || 'none';
  return `${left} vs ${right}`;
}

function pawnBySide(pieces: BoardPiece[]): PerSide<BoardPiece[]> {
  return {
    white: pieces.filter((p) => p.type === 'p' && p.color === 'white'),
    black: pieces.filter((p) => p.type === 'p' && p.color === 'black'),
  };
}

function passedPawn(pawn: BoardPiece, enemyPawns: BoardPiece[]): boolean {
  const f = fileIndex(fileOf(pawn.square));
  const ranksAhead = enemyPawns.filter((ep) => {
    const ef = fileIndex(fileOf(ep.square));
    if (Math.abs(ef - f) > 1) return false;
    return pawn.color === 'white' ? rankOf(ep.square) > rankOf(pawn.square) : rankOf(ep.square) < rankOf(pawn.square);
  });
  return ranksAhead.length === 0;
}

function computePawns(pieces: BoardPiece[]): PawnFeatures {
  const pawns = pawnBySide(pieces);
  const per = (side: Side): BoardPiece[] => pawns[side];
  const onFile = (side: Side, file: string): BoardPiece[] => per(side).filter((p) => fileOf(p.square) === file);
  const isolated = (pawn: BoardPiece): boolean =>
    adjacentFiles(fileOf(pawn.square)).every((f) => onFile(pawn.color, f).length === 0);

  const doubled: PerSide<string[]> = { white: [], black: [] };
  const isolatedOut: PerSide<string[]> = { white: [], black: [] };
  const backward: PerSide<string[]> = { white: [], black: [] };
  const passed: PerSide<string[]> = { white: [], black: [] };
  const candidate: PerSide<string[]> = { white: [], black: [] };
  const chains: PawnFeatures['chains'] = { white: [], black: [] };
  const islands: PerSide<number> = { white: 0, black: 0 };

  for (const side of ['white', 'black'] as const) {
    for (const file of FILES) {
      const list = onFile(side, file);
      if (list.length > 1) doubled[side].push(...list.map((p) => p.square).sort(compareSquares));
    }
    for (const pawn of per(side)) {
      if (isolated(pawn)) isolatedOut[side].push(pawn.square);
      const enemy = per(opponent(side));
      if (passedPawn(pawn, enemy)) passed[side].push(pawn.square);
      // Match the build-time candidate-passer rule: the pawn is not already
      // passed, has no same-file blocker ahead, and adjacent-file supporters
      // from this rank back outnumber adjacent-file guards ahead.
      if (!passed[side].includes(pawn.square)) {
        const rank = rankOf(pawn.square);
        const ahead = (other: BoardPiece): boolean =>
          side === 'white' ? rankOf(other.square) > rank : rankOf(other.square) < rank;
        const file = fileIndex(fileOf(pawn.square));
        const enemy = per(opponent(side));
        const sameFileBlocker = enemy.some((other) => fileIndex(fileOf(other.square)) === file && ahead(other));
        const guards = enemy.filter((other) => Math.abs(fileIndex(fileOf(other.square)) - file) === 1 && ahead(other)).length;
        const supporters = per(side).filter(
          (other) => Math.abs(fileIndex(fileOf(other.square)) - file) === 1 && !ahead(other),
        ).length;
        if (!sameFileBlocker && supporters >= guards) candidate[side].push(pawn.square);
      }
      // Backward approximation: isolated pawn that cannot advance safely (deferred full SEE logic).
      if (isolated(pawn)) backward[side].push(pawn.square);
    }

    const filesWithPawns = FILES.filter((f) => onFile(side, f).length > 0);
    let runs = 0;
    let prev = -2;
    for (const f of filesWithPawns) {
      const idx = fileIndex(f);
      if (idx !== prev + 1) runs += 1;
      prev = idx;
    }
    islands[side] = runs;
  }

  // Simple chain detection: pawn supported by a same-color pawn on rear diagonal.
  for (const side of ['white', 'black'] as const) {
    const set = new Set(per(side).map((p) => p.square));
    for (const pawn of per(side)) {
      const r = rankOf(pawn.square);
      const f = fileIndex(fileOf(pawn.square));
      const backRank = side === 'white' ? r - 1 : r + 1;
      if (backRank < 1 || backRank > 8) continue;
      const supports: Square[] = [];
      if (f > 0) supports.push(`${FILES[f - 1]}${backRank}` as Square);
      if (f < 7) supports.push(`${FILES[f + 1]}${backRank}` as Square);
      const base = supports.find((s) => set.has(s));
      if (base) chains[side].push({ base, head: pawn.square });
    }
  }

  const countByWing = (side: Side, wing: 'queenside' | 'kingside' | 'center'): number => {
    const files =
      wing === 'queenside' ? ['a', 'b', 'c'] : wing === 'kingside' ? ['f', 'g', 'h'] : ['d', 'e'];
    return per(side).filter((p) => files.includes(fileOf(p.square))).length;
  };

  const majority = (wing: 'queenside' | 'kingside' | 'center'): Side | null => {
    const w = countByWing('white', wing);
    const b = countByWing('black', wing);
    if (w === b) return null;
    return w > b ? 'white' : 'black';
  };

  const iqp = (['white', 'black'] as const).find((side) => {
    const dPawns = onFile(side, 'd');
    if (dPawns.length !== 1) return false;
    const onlyD = dPawns[0];
    if (!onlyD) return false;
    return isolated(onlyD);
  }) ?? null;

  const hangingDuo = (['white', 'black'] as const).find((side) => {
    const c = onFile(side, 'c').length > 0;
    const d = onFile(side, 'd').length > 0;
    if (!c || !d) return false;
    return onFile(side, 'b').length === 0 && onFile(side, 'e').length === 0;
  }) ?? null;

  return {
    doubled,
    isolated: isolatedOut,
    backward,
    passed,
    candidate_passers: candidate,
    islands,
    chains,
    majorities: { queenside: majority('queenside'), kingside: majority('kingside'), center: majority('center') },
    iqp,
    hanging_duo: hangingDuo,
  };
}

function attackers(board: Chess, square: Square, side: Side): string[] {
  const maybe = board as unknown as {
    attackers?: (s: Square, c?: 'w' | 'b') => string[];
  };
  if (!maybe.attackers) return [];
  try {
    return maybe.attackers(square, side === 'white' ? 'w' : 'b');
  } catch {
    return [];
  }
}

function pawnAttackSquares(pawn: BoardPiece): Square[] {
  const f = fileIndex(fileOf(pawn.square));
  const r = rankOf(pawn.square);
  const dr = pawn.color === 'white' ? 1 : -1;
  const rank = r + dr;
  if (rank < 1 || rank > 8) return [];
  const out: Square[] = [];
  if (f > 0) out.push(`${FILES[f - 1]}${rank}` as Square);
  if (f < 7) out.push(`${FILES[f + 1]}${rank}` as Square);
  return out;
}

function computeKingSafety(board: Chess, pieces: BoardPiece[]): PerSide<KingSafetySide> {
  const pawns = pawnBySide(pieces);
  const fileHasPawn = (side: Side, file: string): boolean => pawns[side].some((p) => fileOf(p.square) === file);
  const kingSquare = (side: Side): Square | null =>
    pieces.find((p) => p.type === 'k' && p.color === side)?.square ?? null;

  const one = (side: Side): KingSafetySide => {
    const ksq = kingSquare(side);
    if (!ksq) {
      return { castled: 'none', shield: 'n/a', adjacent_open_files: [], adjacent_half_open_files: [], king_zone_attackers: 0 };
    }
    const castled = ksq === 'g1' || ksq === 'g8' ? 'short' : ksq === 'c1' || ksq === 'c8' ? 'long' : 'none';
    const kingFile = fileOf(ksq);
    const files = [kingFile, ...adjacentFiles(kingFile)];
    const adjacent_open_files: string[] = [];
    const adjacent_half_open_files: string[] = [];
    for (const f of files) {
      const ours = fileHasPawn(side, f);
      const theirs = fileHasPawn(opponent(side), f);
      if (!ours && !theirs) adjacent_open_files.push(f);
      else if (!ours && theirs) adjacent_half_open_files.push(f);
    }
    const homeRank = side === 'white' ? 2 : 7;
    const shieldSquares =
      castled === 'short'
        ? (['f', 'g', 'h'] as const).map((f) => `${f}${homeRank}` as Square)
        : castled === 'long'
          ? (['a', 'b', 'c'] as const).map((f) => `${f}${homeRank}` as Square)
          : [];
    const shieldCount = shieldSquares.filter((sq) => {
      const piece = board.get(sq);
      return piece?.type === 'p' && toSide(piece.color) === side;
    }).length;
    const shield: KingSafetySide['shield'] =
      castled === 'none' ? 'n/a' : shieldCount === 3 ? 'intact' : shieldCount === 2 ? 'one-breach' : 'shattered';

    const zone: Square[] = [];
    const kFile = fileIndex(kingFile);
    const kRank = rankOf(ksq);
    for (let df = -1; df <= 1; df += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        const ff = kFile + df;
        const rr = kRank + dr;
        if (ff < 0 || ff > 7 || rr < 1 || rr > 8) continue;
        zone.push(`${FILES[ff]}${rr}` as Square);
      }
    }
    const attackersCount = new Set(zone.flatMap((sq) => attackers(board, sq, opponent(side)))).size;

    return {
      castled,
      shield,
      adjacent_open_files,
      adjacent_half_open_files,
      king_zone_attackers: attackersCount,
    };
  };

  return { white: one('white'), black: one('black') };
}

function computeCenterSpace(board: Chess, pieces: BoardPiece[]) {
  const center_occupancy: Record<string, string | null> = {};
  for (const sq of CENTRAL_SQUARES) {
    const p = board.get(sq);
    center_occupancy[sq] = p ? (p.color === "w" ? "white" : "black") + "_" + ({ p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" } as const)[p.type] : null;
  }
  const center_attacks = {
    white: CENTRAL_SQUARES.reduce((n, sq) => n + attackers(board, sq, 'white').length, 0),
    black: CENTRAL_SQUARES.reduce((n, sq) => n + attackers(board, sq, 'black').length, 0),
  };

  const pawnSquares = pawnBySide(pieces);
  const spaceSquares = (side: Side): number => {
    const attacked = new Set<Square>();
    for (const p of pawnSquares[side]) {
      for (const sq of pawnAttackSquares(p)) {
        const r = rankOf(sq);
        if ((side === 'white' && r >= 5) || (side === 'black' && r <= 4)) attacked.add(sq);
      }
    }
    return attacked.size;
  };
  const centralPawns = pieces.filter((p) => p.type === 'p' && CENTRAL_SQUARES.includes(p.square));
  const whiteCentralPawns = centralPawns.filter((p) => p.color === 'white');
  const blackCentralPawns = centralPawns.filter((p) => p.color === 'black');
  const hasCenterCapture = whiteCentralPawns.some((wp) =>
    pawnAttackSquares(wp).some((sq) => {
      const target = board.get(sq);
      return target?.type === 'p' && target.color === 'b' && CENTRAL_SQUARES.includes(sq);
    }),
  );
  const locked_center =
    whiteCentralPawns.length > 0 &&
    blackCentralPawns.length > 0 &&
    !hasCenterCapture;

  return {
    center_occupancy,
    center_attacks,
    space: { white: spaceSquares('white'), black: spaceSquares('black') },
    locked_center,
  };
}

function computeFilesDiagonals(pieces: BoardPiece[]): FilesDiagonalsFeatures {
  const pawns = pawnBySide(pieces);
  const open_files = FILES.filter((f) => {
    const w = pawns.white.some((p) => fileOf(p.square) === f);
    const b = pawns.black.some((p) => fileOf(p.square) === f);
    return !w && !b;
  });

  const halfOpen = (side: Side): string[] =>
    FILES.filter((f) => {
      const ours = pawns[side].some((p) => fileOf(p.square) === f);
      const theirs = pawns[opponent(side)].some((p) => fileOf(p.square) === f);
      return !ours && theirs;
    });
  const rooks = {
    white: pieces.filter((p) => p.type === 'r' && p.color === 'white').map((p) => p.square),
    black: pieces.filter((p) => p.type === 'r' && p.color === 'black').map((p) => p.square),
  };
  const rookOn = (squares: Square[], files: string[]): string[] =>
    squares.filter((sq) => files.includes(fileOf(sq)));

  const diagonalOwnership = (diagSquares: readonly Square[]): Side | 'contested' => {
    const owner = { white: false, black: false };
    for (const p of pieces) {
      if (p.type !== 'b' && p.type !== 'q') continue;
      if (!diagSquares.includes(p.square)) continue;
      owner[p.color] = true;
    }
    if (owner.white && !owner.black) return 'white';
    if (owner.black && !owner.white) return 'black';
    return 'contested';
  };

  return {
    open_files,
    half_open: { white: halfOpen('white'), black: halfOpen('black') },
    rooks_on_open: { white: rookOn(rooks.white, open_files), black: rookOn(rooks.black, open_files) },
    rooks_on_half_open: {
      white: rookOn(rooks.white, halfOpen('white')),
      black: rookOn(rooks.black, halfOpen('black')),
    },
    rook_on_seventh: {
      white: rooks.white.filter((sq) => rankOf(sq) === 7).map((sq) => `R${sq}`),
      black: rooks.black.filter((sq) => rankOf(sq) === 2).map((sq) => `R${sq}`),
    },
    long_diagonals: {
      a1h8: diagonalOwnership(['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7', 'h8']),
      h1a8: diagonalOwnership(['h1', 'g2', 'f3', 'e4', 'd5', 'c6', 'b7', 'a8']),
    },
  };
}

function setTurn(fen: string, side: Side): string {
  const parts = fen.split(' ');
  if (parts.length < 2) return fen;
  parts[1] = side === 'white' ? 'w' : 'b';
  return parts.join(' ');
}

function moveCountsByPiece(board: Chess, side: Side): Record<string, number[]> {
  const clone = new Chess(setTurn(board.fen(), side));
  const moves = clone.moves({ verbose: true });
  const out: Record<string, number[]> = {};
  for (const m of moves) {
    const key = `${m.piece}@${m.from}`;
    out[key] = out[key] ?? [];
    out[key].push(1);
  }
  return out;
}

function attackedSquaresFrom(board: Chess, piece: BoardPiece): Square[] {
  const clone = new Chess(setTurn(board.fen(), piece.color));
  return clone
    .moves({ verbose: true })
    .filter((m) => m.from === piece.square)
    .map((m) => m.to as Square);
}

function pieceLabel(piece: BoardPiece): string {
  return `${piece.type === "p" ? "" : piece.type.toUpperCase()}${piece.square}`;
}

function pieceValue(type: PieceSymbol): number {
  switch (type) {
    case 'q':
      return 9;
    case 'r':
      return 5;
    case 'b':
    case 'n':
      return 3;
    case 'p':
      return 1;
    case 'k':
      return 100;
  }
}

const RAY_DIRS = {
  bishop: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  rook: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
} as const;

function squaresAlongRay(from: Square, df: number, dr: number): Square[] {
  const out: Square[] = [];
  let f = fileIndex(fileOf(from)) + df;
  let r = rankOf(from) + dr;
  while (f >= 0 && f <= 7 && r >= 1 && r <= 8) {
    out.push(`${FILES[f]}${r}` as Square);
    f += df;
    r += dr;
  }
  return out;
}

function firstTwoOccupiedOnRay(board: Chess, from: Square, df: number, dr: number): BoardPiece[] {
  const hits: BoardPiece[] = [];
  for (const sq of squaresAlongRay(from, df, dr)) {
    const p = board.get(sq);
    if (!p) continue;
    hits.push({ square: sq, color: toSide(p.color), type: p.type });
    if (hits.length === 2) break;
  }
  return hits;
}

function computeActivityAndTactics(board: Chess, pieces: BoardPiece[]): {
  activity: ActivityFeatures;
  tactics: TacticsGeometryFeatures;
} {
  const undeveloped = (side: Side): number => {
    const starts = side === 'white' ? START_MINOR_WHITE : START_MINOR_BLACK;
    return pieces.filter((p) => p.color === side && (p.type === 'n' || p.type === 'b') && starts.has(p.square)).length;
  };
  const outposts: PerSide<OutpostSide> = {
    white: { occupied: [], available: [] },
    black: { occupied: [], available: [] },
  };
  const badBishopFor = (side: Side): string | null => {
    const direction = side === "white" ? 1 : -1;
    for (const bishop of pieces.filter((p) => p.color === side && p.type === "b").sort((a, b) => compareSquares(a.square, b.square))) {
      const bishopColor = (fileIndex(fileOf(bishop.square)) + rankOf(bishop.square)) % 2;
      const fixed = pawnBySide(pieces)[side].filter((pawn) => {
        if ((fileIndex(fileOf(pawn.square)) + rankOf(pawn.square)) % 2 !== bishopColor) return false;
        const ahead = rankOf(pawn.square) + direction;
        return ahead >= 1 && ahead <= 8 && Boolean(board.get(`${fileOf(pawn.square)}${ahead}` as Square));
      }).length;
      if (fixed >= 3) return bishop.square;
    }
    return null;
  };
  const badBishop: PerSide<string | null> = { white: badBishopFor("white"), black: badBishopFor("black") };
  const fianchettoFor = (side: Side): string | null => {
    const squares = (side === "white" ? [["g2", ["f2", "g3", "h2"]], ["b2", ["a2", "b3", "c2"]]] : [["g7", ["f7", "g6", "h7"]], ["b7", ["a7", "b6", "c7"]]]) as Array<[Square, Square[]]>;
    for (const [square, shield] of squares) {
      const bishop = board.get(square as Square);
      if (!bishop || bishop.type !== "b" || toSide(bishop.color) !== side) continue;
      const intact = shield.every((shieldSquare) => { const pawn = board.get(shieldSquare as Square); return pawn?.type === "p" && toSide(pawn.color) === side; });
      return `${intact ? "intact" : "broken"}-${square}`;
    }
    return null;
  };
  const fianchetto: PerSide<string | null> = { white: fianchettoFor("white"), black: fianchettoFor("black") };

  const enPrise: string[] = [];
  const pins: TacticsGeometryFeatures['pins'] = [];
  const xrays: TacticsGeometryFeatures['xrays'] = [];
  const overloaded: TacticsGeometryFeatures['overloaded'] = [];
  const discoveredCandidates: TacticsGeometryFeatures['discovered_candidates'] = [];

  for (const side of ['white', 'black'] as const) {
    const enemyPawnAttacks = new Set<Square>(
      pawnBySide(pieces)[opponent(side)].flatMap((p) => pawnAttackSquares(p)),
    );
    const ownPiecesBySquare = new Map<string, BoardPiece>(
      pieces
        .filter((p) => p.color === side)
        .map((p) => [p.square, p] as const),
    );
    for (const pawn of pawnBySide(pieces)[side]) {
      for (const sq of pawnAttackSquares(pawn)) {
        const inEnemyHalf = side === 'white' ? rankOf(sq) >= 5 : rankOf(sq) <= 4;
        if (!inEnemyHalf) continue;
        if (enemyPawnAttacks.has(sq)) continue;
        const occ = ownPiecesBySquare.get(sq);
        if (!occ) {
          outposts[side].available.push(sq);
          continue;
        }
        if (occ.type === 'n' || occ.type === 'b') outposts[side].occupied.push(sq);
      }
    }
    outposts[side].available.sort();
    outposts[side].occupied.sort();
  }
  for (const p of pieces) {
    if (p.type === "k") continue;
    const atk = attackers(board, p.square, opponent(p.color)).length;
    const def = attackers(board, p.square, p.color).length;
    if (atk > def) enPrise.push(pieceLabel(p));
  }
  enPrise.sort();

  for (const slider of pieces) {
    const dirs = slider.type === "b" ? RAY_DIRS.bishop : slider.type === "r" ? RAY_DIRS.rook : slider.type === "q" ? [...RAY_DIRS.bishop, ...RAY_DIRS.rook] : null;
    if (!dirs) continue;
    for (const [df, dr] of dirs) {
      const hits = firstTwoOccupiedOnRay(board, slider.square, df, dr);
      if (hits.length < 2) continue;
      const [through, target] = hits;
      if (!through || !target || target.color === slider.color || !["k", "q", "r"].includes(target.type)) continue;
      const isPin = through.color !== slider.color && through.type !== "k" && (target.type === "k" || pieceValue(target.type) > pieceValue(through.type));
      if (isPin) {
        pins.push({ by: pieceLabel(slider), pinned: pieceLabel(through), to: pieceLabel(target), absolute: target.type === "k" });
      } else {
        xrays.push({ by: pieceLabel(slider), through: pieceLabel(through), target: pieceLabel(target) });
      }
      if (through.color === slider.color && through.type !== "k") {
        discoveredCandidates.push({ mover: pieceLabel(through), battery_piece: pieceLabel(slider), target: pieceLabel(target) });
      }
    }
  }

  for (const defender of pieces) {
    if (defender.type === 'k') continue;
    const duties = new Set<string>();
    for (const ally of pieces) {
      if (ally.color !== defender.color || ally.square === defender.square || ally.type === 'k') continue;
      const defendedBy = attackers(board, ally.square, defender.color);
      if (!defendedBy.includes(defender.square)) continue;
      const attackedByEnemy = attackers(board, ally.square, opponent(defender.color));
      if (attackedByEnemy.length === 0) continue;
      duties.add(ally.square);
    }
    if (duties.size >= 2) {
      overloaded.push({
        piece: pieceLabel(defender),
        defends: [...duties].sort(),
      });
    }
  }

  // Match the build-time definition: a non-king piece is trapped only when it
  // is already attacked and none of its legal destinations are safe. A
  // destination is safe when the opponent does not attack it, or it is at
  // least as well defended after discounting the moving piece itself.
  const trapped: PerSide<string[]> = { white: [], black: [] };
  for (const side of ['white', 'black'] as const) {
    for (const piece of pieces) {
      if (piece.color !== side || !['n', 'b', 'r', 'q'].includes(piece.type)) continue;
      if (attackers(board, piece.square, opponent(side)).length === 0) continue;
      const hasSafeDestination = attackedSquaresFrom(board, piece).some((target) => {
        const enemyAttackers = attackers(board, target, opponent(side)).length;
        const defenders = Math.max(0, attackers(board, target, side).length - 1);
        return enemyAttackers === 0 || defenders >= enemyAttackers;
      });
      if (!hasSafeDestination) trapped[side].push(pieceLabel(piece));
    }
    trapped[side].sort();
  }

  const castlingRights = board.fen().split(' ')[2] ?? '-';
  const developed = (side: Side): number => {
    const hasRights = side === 'white' ? /[KQ]/.test(castlingRights) : /[kq]/.test(castlingRights);
    return 4 - undeveloped(side) + (hasRights ? 0 : 1);
  };
  const developmentDifference = developed('white') - developed('black');

  const activity: ActivityFeatures = {
    mobility: {
      white: moveCountsByPiece(board, 'white'),
      black: moveCountsByPiece(board, 'black'),
    },
    outposts,
    bad_bishop: badBishop,
    fianchetto,
    trapped,
    undeveloped_minors: {
      white: undeveloped('white'),
      black: undeveloped('black'),
    },
    tempo: {
      side_to_move: board.turn() === 'w' ? 'white' : 'black',
      development_lead:
        developmentDifference === 0
          ? 'even'
          : developmentDifference > 0
            ? `white+${developmentDifference}`
            : `black+${-developmentDifference}`,
    },
  };

  return {
    activity,
    tactics: {
      pins: pins.sort((a, b) => `${a.by}:${a.pinned}:${a.to}`.localeCompare(`${b.by}:${b.pinned}:${b.to}`)),
      xrays: xrays.sort((a, b) => `${a.by}:${a.through}:${a.target}`.localeCompare(`${b.by}:${b.through}:${b.target}`)),
      overloaded: overloaded.sort((a, b) => a.piece.localeCompare(b.piece)),
      discovered_candidates: discoveredCandidates.sort((a, b) =>
        `${a.mover}:${a.battery_piece}:${a.target}`.localeCompare(
          `${b.mover}:${b.battery_piece}:${b.target}`,
        ),
      ),
      en_prise: enPrise,
    },
  };
}

function computeMotifs(
  board: Chess,
  pieces: BoardPiece[],
  tactics: TacticsGeometryFeatures,
): MotifFeatures {
  const pins: MotifFeatures['pins'] = tactics.pins.map((p) => ({
    by: p.by,
    pinned: p.pinned,
    to: p.to,
    kind: p.absolute ? 'absolute' : 'relative',
    confidence: 'high',
  }));

  const removing_defender: MotifFeatures['removing_defender'] = tactics.overloaded.map((o) => ({
    defender: o.piece,
    abandons: [...o.defends].sort(),
    confidence: 'high',
  }));

  const hanging: MotifFeatures['hanging'] = [];
  for (const victim of pieces) {
    if (victim.type === 'k') continue;
    const atk = attackers(board, victim.square, opponent(victim.color));
    const def = attackers(board, victim.square, victim.color);
    if (atk.length === 0 || def.length > 0) continue;
    const bySquare = [...atk].sort()[0];
    if (!bySquare) continue;
    const byPiece = board.get(bySquare as Square);
    if (!byPiece) continue;
    hanging.push({
      piece: pieceLabel(victim),
      by: pieceLabel({ square: bySquare as Square, color: toSide(byPiece.color), type: byPiece.type }),
      confidence: 'high',
    });
  }

  const forks: MotifFeatures['forks'] = [];
  for (const attacker of pieces) {
    if (attacker.type !== 'n' && attacker.type !== 'q') continue;
    const attackedSquares = attackedSquaresFrom(board, attacker);
    const targets = attackedSquares
      .map((sq) => board.get(sq as Square))
      .map((p, i) => ({ p, sq: attackedSquares[i] as Square }))
      .filter(
        (x): x is { p: NonNullable<typeof x.p>; sq: Square } =>
          x.p !== null && x.p !== undefined && toSide(x.p.color) !== attacker.color && pieceValue(x.p.type) >= 3,
      )
      .sort((a, b) => compareSquares(a.sq, b.sq))
      .map((x) => pieceLabel({ square: x.sq, color: toSide(x.p.color), type: x.p.type }));
    if (targets.length < 2) continue;
    const attackedByEnemyPawns = pawnBySide(pieces)[opponent(attacker.color)]
      .flatMap((p) => pawnAttackSquares(p))
      .includes(attacker.square);
    forks.push({
      by: pieceLabel(attacker),
      targets,
      confidence: attackedByEnemyPawns ? 'speculative' : 'high',
    });
  }

  const skewers: MotifFeatures['skewers'] = [];
  for (const slider of pieces) {
    const dirs =
      slider.type === 'b'
        ? RAY_DIRS.bishop
        : slider.type === 'r'
          ? RAY_DIRS.rook
          : slider.type === 'q'
            ? [...RAY_DIRS.bishop, ...RAY_DIRS.rook]
            : null;
    if (!dirs) continue;
    for (const [df, dr] of dirs) {
      const hits = firstTwoOccupiedOnRay(board, slider.square, df, dr);
      if (hits.length < 2) continue;
      const [front, back] = hits;
      if (!front || !back) continue;
      if (front.color === slider.color || back.color === slider.color) continue;
      if (pieceValue(front.type) <= pieceValue(back.type)) continue;
      skewers.push({
        by: pieceLabel(slider),
        front: pieceLabel(front),
        back: pieceLabel(back),
        confidence: 'high',
      });
    }
  }

  const batteryMap = new Map<string, { pieces: string[]; target: string }>();
  for (const d of tactics.discovered_candidates) {
    if (d.mover.length === 2) continue;
    const piecesPair = [d.battery_piece, d.mover].sort((a, b) => {
      const aType = a[0]?.toLowerCase() as PieceSymbol | undefined;
      const bType = b[0]?.toLowerCase() as PieceSymbol | undefined;
      const av = aType ? pieceValue(aType) : 0;
      const bv = bType ? pieceValue(bType) : 0;
      return bv - av || a.localeCompare(b);
    });
    const key = `${piecesPair.join('|')}=>${d.target}`;
    batteryMap.set(key, { pieces: piecesPair, target: d.target });
  }
  const batteries: MotifFeatures['batteries'] = [...batteryMap.values()].map((b) => ({
    pieces: b.pieces,
    target: b.target,
    confidence: 'high',
  }));

  return {
    forks: forks.sort((a, b) => `${a.by}:${a.targets.join(',')}`.localeCompare(`${b.by}:${b.targets.join(',')}`)),
    skewers: skewers.sort((a, b) => `${a.by}:${a.front}:${a.back}`.localeCompare(`${b.by}:${b.front}:${b.back}`)),
    batteries: batteries.sort((a, b) => `${a.pieces.join(',')}:${a.target}`.localeCompare(`${b.pieces.join(',')}:${b.target}`)),
    pins: pins.sort((a, b) => `${a.by}:${a.pinned}:${a.to}`.localeCompare(`${b.by}:${b.pinned}:${b.to}`)),
    removing_defender: removing_defender.sort((a, b) => a.defender.localeCompare(b.defender)),
    hanging: hanging.sort((a, b) => `${a.piece}:${a.by}`.localeCompare(`${b.piece}:${b.by}`)),
  };
}

function computeClassification(board: Chess, features: Pick<PositionFeatures, 'center_space' | 'pawns' | 'material'>): ClassificationFeatures {
  const pieces = collectPieces(board);
  const sideHasPawnOnFile = (side: Side, file: string): boolean =>
    pieces.some((p) => p.type === "p" && p.color === side && fileOf(p.square) === file);
  const centerPawns = CENTRAL_SQUARES.filter((sq) => board.get(sq)?.type === 'p');
  const hasDirectOpposition =
    (board.get('d4')?.type === 'p' && board.get('d5')?.type === 'p') ||
    (board.get('e4')?.type === 'p' && board.get('e5')?.type === 'p');
  const open_files_central = ['d', 'e'].filter((f) => !sideHasPawnOnFile('white', f) && !sideHasPawnOnFile('black', f));
  const centralCaptureExists = (() => {
    for (const sq of CENTRAL_SQUARES) {
      const piece = board.get(sq);
      if (!piece || piece.type !== 'p') continue;
      const pawn: BoardPiece = { square: sq, color: toSide(piece.color), type: 'p' };
      for (const target of pawnAttackSquares(pawn)) {
        if (!CENTRAL_SQUARES.includes(target)) continue;
        const tp = board.get(target);
        if (tp?.type === 'p' && tp.color !== piece.color) return true;
      }
    }
    return false;
  })();
  const type: CenterType = hasDirectOpposition
    ? 'fixed'
    : centerPawns.length >= 3
      ? 'closed'
      : centralCaptureExists
        ? 'tension'
        : open_files_central.length > 0 && centerPawns.length <= 1
          ? 'open'
          : 'fluid';

  const hasPawnOn = (sq: Square, side: Side): boolean => {
    const p = board.get(sq);
    return p?.type === 'p' && toSide(p.color) === side;
  };
  const structures: string[] = [];
  if (features.pawns.iqp) structures.push('isolated-queens-pawn');
  if (
    hasPawnOn('c3', 'white') &&
    hasPawnOn('d4', 'white') &&
    hasPawnOn('e3', 'white') &&
    hasPawnOn('f4', 'white')
  ) {
    structures.push('stonewall-white');
  }
  if (hasPawnOn('c4', 'white') && hasPawnOn('e4', 'white') && !sideHasPawnOnFile('white', 'd')) {
    structures.push('maroczy-bind-white');
  }
  const symmetric = (() => {
    for (const p of pieces) {
      const mirror = `${fileOf(p.square)}${9 - rankOf(p.square)}` as Square;
      const m = board.get(mirror);
      if (!m) return false;
      if (m.type !== p.type) return false;
      if (toSide(m.color) === p.color) return false;
    }
    return true;
  })();
  if (symmetric) structures.push('symmetric');
  structures.sort();

  const deltaSpace = features.center_space.space.white - features.center_space.space.black;
  const space_edge: Side | null = type === 'fixed' ? null : deltaSpace >= 2 ? 'white' : deltaSpace <= -2 ? 'black' : null;
  const imbalance = Math.abs(features.material.balance_cp);
  const character: ClassificationFeatures['character'] =
    type === 'open'
      ? 'open-tactical'
      : type === 'closed'
        ? 'closed-maneuvering'
        : imbalance >= 250
          ? 'sharp-imbalanced'
          : 'balanced';

  return {
    center: { type, open_files_central, space_edge },
    structures,
    character,
  };
}

export class RuntimeFeatureExtractor implements FeatureExtractor {
  private readonly cache = new Map<string, PositionFeatures | null>();

  async extract(fen: string): Promise<PositionFeatures | null> {
    if (this.cache.has(fen)) return this.cache.get(fen) ?? null;
    let board: Chess;
    try {
      board = new Chess(fen);
    } catch {
      this.cache.set(fen, null);
      return null;
    }
    const pieces = collectPieces(board);
    const balance_cp = materialCp(pieces);
    const pawns = computePawns(pieces);
    const center_space = computeCenterSpace(board, pieces);
    const { activity, tactics } = computeActivityAndTactics(board, pieces);
    const base: PositionFeatures = {
      version: RUNTIME_EXTRACTOR_VERSION,
      material: {
        balance_cp,
        imbalance: describeImbalanceFromPieces(pieces),
        bishop_pair: {
          white: pieces.filter((p) => p.color === 'white' && p.type === 'b').length >= 2,
          black: pieces.filter((p) => p.color === 'black' && p.type === 'b').length >= 2,
        },
      },
      pawns,
      king_safety: computeKingSafety(board, pieces),
      center_space,
      files_diagonals: computeFilesDiagonals(pieces),
      activity,
      tactics_geometry: tactics,
      motifs: computeMotifs(board, pieces, tactics),
    };
    base.classification = computeClassification(board, {
      center_space: base.center_space,
      pawns: base.pawns,
      material: base.material,
    });
    this.cache.set(fen, base);
    return base;
  }
}

export type RuntimeFeaturesSnapshot = Pick<FeaturesSidecar, 'extractor_version'>;
export const runtimeFeaturesInfo: RuntimeFeaturesSnapshot = {
  extractor_version: RUNTIME_EXTRACTOR_VERSION,
};
