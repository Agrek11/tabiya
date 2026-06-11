"""Group 1 — material: balance, imbalance label, bishop pair (design-4b §definitions)."""

from __future__ import annotations

from collections import Counter
from typing import Any

import chess

from .util import PIECE_LETTERS, PIECE_VALUES_CP


def material(board: chess.Board) -> dict[str, Any]:
    balance = 0
    counts: dict[chess.Color, Counter[chess.PieceType]] = {
        chess.WHITE: Counter(),
        chess.BLACK: Counter(),
    }
    for square, piece in board.piece_map().items():
        del square
        counts[piece.color][piece.piece_type] += 1
        value = PIECE_VALUES_CP[piece.piece_type]
        balance += value if piece.color == chess.WHITE else -value

    return {
        "balance_cp": balance,
        "imbalance": _imbalance_label(counts),
        "bishop_pair": {
            "white": counts[chess.WHITE][chess.BISHOP] >= 2,
            "black": counts[chess.BLACK][chess.BISHOP] >= 2,
        },
    }


def _imbalance_label(counts: dict[chess.Color, Counter[chess.PieceType]]) -> str:
    """Describe the piece-type diff, e.g. "R+P vs B+N"; "none" when equal.

    Pawn-count diffs are included as repeated P's capped at 2 ("P+P") to keep
    labels short; equal material (by type counts) is "none" even if positions
    differ.
    """
    white_extra: list[str] = []
    black_extra: list[str] = []
    for piece_type in (chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KNIGHT, chess.PAWN):
        diff = counts[chess.WHITE][piece_type] - counts[chess.BLACK][piece_type]
        letter = PIECE_LETTERS[piece_type] or "P"
        capped = min(abs(diff), 2)
        side = white_extra if diff > 0 else black_extra
        side.extend([letter] * capped if diff != 0 else [])
    if not white_extra and not black_extra:
        return "none"
    left = "+".join(white_extra) or "—"
    right = "+".join(black_extra) or "—"
    return f"{left} vs {right}"
