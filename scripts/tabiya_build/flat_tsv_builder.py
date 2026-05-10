"""Flat TSV ingest — emit every Lichess TSV row as Opening + Line.

Phase 0d.3 follow-up: rather than ~18 curated openings extended via Lichess
Explorer (the existing whitelist+extender pipeline), this module flattens the
entire `lichess-org/chess-openings` TSV namespace into the catalog. One row
in TSV → one Opening + one Line. ~3690 rows total today.

Per-row mapping:
    eco          → opening.eco
    name         → opening.name (verbatim, including ":" + sub-variation)
    pgn          → line.moves (parsed via python-chess into SAN list)
    is_gambit    → "gambit" (case-insensitive substring) in name
    color        → best-effort guess from name keywords + first move
    family_id    → "uncategorized" (user groups later)

Lines exceeding Constitution Article 8's 20-ply hard cap are SKIPPED with
a warning. Article 8 has no exceptions.

The curated whitelist + Explorer pipeline remains the default. Switch to
this path with `build_catalog.py --source flat-tsv`.
"""

from __future__ import annotations

import logging

import chess

from .schema import Color, Line, Opening
from .slug import IdMinter, slugify
from .tsv import TsvRow

logger = logging.getLogger(__name__)

UNCATEGORIZED_FAMILY_ID = "uncategorized"
MAX_PLY = 20  # Constitution Article 8 hard cap

# Name keywords that strongly imply Black's side as the side being drilled.
_BLACK_DEFENSE_KEYWORDS = (
    "defense",
    "defence",
    "indian",
    "sicilian",
    "caro-kann",
    "scandinavian",
    "pirc",
    "alekhine",
    "modern",
    "kid",
    "qid",
    "nimzo",
    "grunfeld",
    "grünfeld",
    "benoni",
    "dutch",
    "slav",
    "semi-slav",
)


def _infer_color(name: str, first_move_white: str | None) -> Color:
    """Best-effort: name keywords first, then fall back to white.

    Convention: 'Defense', '...Indian', 'Sicilian' etc. → drill as Black.
    Most everything else (Openings, Attacks, Gambits launched by White) → White.
    """
    lower = name.lower()
    for kw in _BLACK_DEFENSE_KEYWORDS:
        if kw in lower:
            return "black"
    # Fallback: if the first move suggests a black-side response system whose
    # name doesn't match keywords, default to white. User can override later.
    _ = first_move_white  # currently unused; reserved for future heuristic
    return "white"


def _replay_to_end_fen(moves: list[str]) -> str | None:
    """Replay moves on a fresh board to capture end_fen. Returns None if any
    move fails to parse — caller skips the row in that case."""
    board = chess.Board()
    for san in moves:
        try:
            move = board.parse_san(san)
        except (
            ValueError,
            chess.IllegalMoveError,
            chess.AmbiguousMoveError,
            chess.InvalidMoveError,
        ):
            return None
        board.push(move)
    return board.fen()


def build_from_tsv_rows(rows: list[TsvRow]) -> tuple[list[Opening], list[Line]]:
    """Convert every TSV row into one Opening + one Line.

    Skips rows that:
      * have ply > MAX_PLY (Constitution Article 8)
      * fail SAN legality replay (corrupt / ambiguous PGN)
      * collide on slug ids that even the IdMinter can't disambiguate cleanly
        (extremely rare)
    """
    minter = IdMinter()
    openings: list[Opening] = []
    lines: list[Line] = []

    skipped_depth = 0
    skipped_illegal = 0

    for row in rows:
        san_moves: list[str] = list(row.san_moves)
        if len(san_moves) == 0:
            # Some TSV rows ("Amar Opening" with just "1. Nh3") still parse to
            # 1 ply; rows with zero are anomalies (empty pgn). Skip.
            continue
        if len(san_moves) > MAX_PLY:
            skipped_depth += 1
            continue

        end_fen = _replay_to_end_fen(san_moves)
        if end_fen is None:
            skipped_illegal += 1
            continue

        opening_id = minter.mint(slugify(row.name))
        line_id = minter.mint(slugify(f"{row.name}-main"))

        is_gambit = "gambit" in row.name.lower()
        first_white_move = san_moves[0] if len(san_moves) > 0 else None
        color = _infer_color(row.name, first_white_move)

        line = Line(
            id=line_id,
            opening_id=opening_id,
            name="Main Line",
            moves=san_moves,
            depth=len(san_moves),
            end_fen=end_fen,
            popularity=0.0,
            tags=["gambit"] if is_gambit else [],
            strategic_notes=[],
            key_squares=[],
        )
        opening = Opening(
            id=opening_id,
            family_id=UNCATEGORIZED_FAMILY_ID,
            name=row.name,
            eco=row.eco,
            color=color,
            line_ids=[line_id],
            is_gambit=is_gambit,
        )

        openings.append(opening)
        lines.append(line)

    if skipped_depth > 0:
        logger.warning(
            "Skipped %d TSV rows exceeding Article 8 ply cap (%d)",
            skipped_depth,
            MAX_PLY,
        )
    if skipped_illegal > 0:
        logger.warning(
            "Skipped %d TSV rows with illegal/ambiguous SAN sequences",
            skipped_illegal,
        )

    logger.info(
        "Flat-TSV build: emitted %d openings (skipped %d depth, %d illegal)",
        len(openings),
        skipped_depth,
        skipped_illegal,
    )
    return openings, lines
