"""Line extender — walks the Explorer API to extend an opening's seed line
to its target depth, applying stop conditions per design AD5.

Constitution Articles 7 (linear lines), 8 (depth cap 20), 9 (SAN format).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Literal

import chess

from .explorer import ExplorerClient
from .whitelist import DEFAULT_DEPTH, OpeningSpec

logger = logging.getLogger(__name__)

POPULARITY_THRESHOLD = 0.15        # Req 4.6
SECOND_BRANCH_GAP_MAX = 0.05       # Req 4.5
HARD_DEPTH_CAP = 20                # Constitution Article 8

StopCode = Literal["depth_reached", "low_popularity", "no_continuations"]


@dataclass(frozen=True)
class StopReason:
    code: StopCode


@dataclass(frozen=True)
class ExtendedLine:
    """One linear extended line, with the stop reason that ended it."""

    moves: list[str]      # SAN moves including the seed
    end_fen: str
    popularity: float     # popularity at the last extended ply (or 1.0 if seed-only)
    stop: StopReason


# ---------------------------------------------------------------------------
# Helpers (pure)
# ---------------------------------------------------------------------------


def seed_to_san(seed_pgn: str) -> list[str]:
    """Parse a PGN-fragment seed (e.g. "1. e4 e5 2. Nf3 Nc6 3. Bb5") to SAN list."""
    board = chess.Board()
    out: list[str] = []
    for tok in seed_pgn.replace("\n", " ").split():
        if tok[0].isdigit() and "." in tok:
            continue
        if tok in {"1-0", "0-1", "1/2-1/2", "*"}:
            break
        move = board.parse_san(tok)
        out.append(board.san(move))
        board.push(move)
    return out


def play_moves(san_moves: list[str]) -> chess.Board:
    """Apply SAN moves to a fresh board and return it."""
    b = chess.Board()
    for san in san_moves:
        b.push_san(san)
    return b


def relative_frequency(top_total: int, response_total: int) -> float:
    if response_total <= 0:
        return 0.0
    return top_total / response_total


def resolve_depth_cap(spec: OpeningSpec, max_depth: int | None) -> int:
    """Compute effective depth cap for a spec, never exceeding the hard cap."""
    if max_depth is not None:
        cap = min(max_depth, HARD_DEPTH_CAP)
    else:
        cap = spec.depth_override or DEFAULT_DEPTH
    return min(cap, HARD_DEPTH_CAP)


# ---------------------------------------------------------------------------
# Core algorithm
# ---------------------------------------------------------------------------


def extend_line(
    spec: OpeningSpec,
    seed_moves: list[str],
    explorer: ExplorerClient,
    max_depth: int | None = None,
) -> ExtendedLine:
    """Extend a single linear line from the seed to (at most) the target depth.

    Stops on three conditions (StopReason.code):
      - "no_continuations" — API returns zero moves at the current position
      - "low_popularity"   — top continuation < POPULARITY_THRESHOLD of total
      - "depth_reached"    — line reached the target depth
    """
    depth_cap = resolve_depth_cap(spec, max_depth)
    board = play_moves(seed_moves)

    moves: list[str] = list(seed_moves)
    popularity: float = 1.0

    if len(moves) >= depth_cap:
        return ExtendedLine(
            moves=moves,
            end_fen=board.fen(),
            popularity=popularity,
            stop=StopReason("depth_reached"),
        )

    while len(moves) < depth_cap:
        response = explorer.fetch(board.fen())
        if not response.moves:
            return ExtendedLine(
                moves=moves,
                end_fen=board.fen(),
                popularity=popularity,
                stop=StopReason("no_continuations"),
            )

        top = response.moves[0]
        total = sum(m.total_games for m in response.moves)
        rel = relative_frequency(top.total_games, total)

        if rel < POPULARITY_THRESHOLD:
            return ExtendedLine(
                moves=moves,
                end_fen=board.fen(),
                popularity=popularity,
                stop=StopReason("low_popularity"),
            )

        try:
            board.push_san(top.san)
        except (ValueError, chess.IllegalMoveError, chess.AmbiguousMoveError):
            logger.warning(
                "Explorer returned non-applyable SAN %r at fen %s — stopping line",
                top.san,
                board.fen(),
            )
            return ExtendedLine(
                moves=moves,
                end_fen=board.fen(),
                popularity=popularity,
                stop=StopReason("no_continuations"),
            )
        moves.append(top.san)
        popularity = rel

    return ExtendedLine(
        moves=moves,
        end_fen=board.fen(),
        popularity=popularity,
        stop=StopReason("depth_reached"),
    )


def extend_with_branch(
    spec: OpeningSpec,
    seed_moves: list[str],
    explorer: ExplorerClient,
    max_depth: int | None = None,
) -> list[ExtendedLine]:
    """Extend the main line plus optionally a second-best branch off the seed.

    The second branch is included when the gap between the top-1 and top-2
    continuations at the seed position is below SECOND_BRANCH_GAP_MAX (Req 4.5).

    Returns 1 or 2 ExtendedLine entries; the main line is always at index 0.
    """
    main = extend_line(spec, seed_moves, explorer, max_depth=max_depth)

    seed_board = play_moves(seed_moves)
    seed_response = explorer.fetch(seed_board.fen())

    if len(seed_response.moves) < 2:
        return [main]

    total = sum(m.total_games for m in seed_response.moves)
    if total <= 0:
        return [main]

    top_freq = relative_frequency(seed_response.moves[0].total_games, total)
    second_freq = relative_frequency(seed_response.moves[1].total_games, total)

    if (top_freq - second_freq) > SECOND_BRANCH_GAP_MAX:
        return [main]

    second_seed = list(seed_moves) + [seed_response.moves[1].san]
    try:
        # Validate the second move is legal from the seed position before extending.
        play_moves(second_seed)
    except (ValueError, chess.IllegalMoveError, chess.AmbiguousMoveError):
        logger.warning(
            "Second-best continuation %r is illegal at %s — skipping branch",
            seed_response.moves[1].san,
            seed_board.fen(),
        )
        return [main]
    branch = extend_line(spec, second_seed, explorer, max_depth=max_depth)
    return [main, branch]
