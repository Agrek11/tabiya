"""Group 4 — center & space (design-4b §definitions)."""

from __future__ import annotations

from typing import Any

import chess

from .util import COLOR_NAMES

CENTER = (chess.D4, chess.E4, chess.D5, chess.E5)


def center_space(board: chess.Board) -> dict[str, Any]:
    occupancy: dict[str, str | None] = {}
    for square in CENTER:
        piece = board.piece_at(square)
        occupancy[chess.square_name(square)] = (
            f"{COLOR_NAMES[piece.color]}_{chess.piece_name(piece.piece_type)}" if piece else None
        )

    attacks = {
        name: sum(len(board.attackers(color, s)) for s in CENTER)
        for color, name in COLOR_NAMES.items()
    }
    return {
        "center_occupancy": occupancy,
        "center_attacks": attacks,
        "space": {name: _space(board, color) for color, name in COLOR_NAMES.items()},
        "locked_center": _locked(board),
    }


def _space(board: chess.Board, color: chess.Color) -> int:
    """Squares in the enemy half attacked by own pawns."""
    enemy_half = range(32, 64) if color == chess.WHITE else range(0, 32)
    attacked: set[chess.Square] = set()
    for pawn in board.pieces(chess.PAWN, color):
        attacked |= set(board.attacks(pawn))
    return len([s for s in attacked if s in enemy_half])


def _locked(board: chess.Board) -> bool:
    """All four center squares pawn-occupied AND no pawn capture exists
    among them."""
    pieces = [board.piece_at(s) for s in CENTER]
    if not all(p and p.piece_type == chess.PAWN for p in pieces):
        return False
    for square in CENTER:
        piece = board.piece_at(square)
        assert piece is not None
        for target in board.attacks(square):
            victim = board.piece_at(target)
            if victim and victim.color != piece.color and target in CENTER:
                return False
    return True
