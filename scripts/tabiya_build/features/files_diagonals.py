"""Group 5 — files & diagonals (design-4b §definitions)."""

from __future__ import annotations

from typing import Any

import chess

from .util import COLOR_NAMES, piece_ref

LONG_DIAGONALS = {
    "a1h8": [chess.square(i, i) for i in range(8)],
    "h1a8": [chess.square(7 - i, i) for i in range(8)],
}


def files_diagonals(board: chess.Board) -> dict[str, Any]:
    open_files: list[str] = []
    half_open: dict[str, list[str]] = {"white": [], "black": []}
    for f in range(8):
        white = any(chess.square_file(s) == f for s in board.pieces(chess.PAWN, chess.WHITE))
        black = any(chess.square_file(s) == f for s in board.pieces(chess.PAWN, chess.BLACK))
        if not white and not black:
            open_files.append(chess.FILE_NAMES[f])
        elif not white:
            half_open["white"].append(chess.FILE_NAMES[f])
        elif not black:
            half_open["black"].append(chess.FILE_NAMES[f])

    rooks_open: dict[str, list[str]] = {"white": [], "black": []}
    rooks_half: dict[str, list[str]] = {"white": [], "black": []}
    seventh: dict[str, list[str]] = {"white": [], "black": []}
    for color, name in COLOR_NAMES.items():
        for rook in sorted(board.pieces(chess.ROOK, color)):
            file_name = chess.FILE_NAMES[chess.square_file(rook)]
            if file_name in open_files:
                rooks_open[name].append(piece_ref(board, rook))
            elif file_name in half_open[name]:
                rooks_half[name].append(piece_ref(board, rook))
            enemy_second = 6 if color == chess.WHITE else 1
            if chess.square_rank(rook) == enemy_second:
                seventh[name].append(piece_ref(board, rook))

    return {
        "open_files": open_files,
        "half_open": half_open,
        "rooks_on_open": rooks_open,
        "rooks_on_half_open": rooks_half,
        "rook_on_seventh": seventh,
        "long_diagonals": {
            diag: _diagonal_control(board, squares) for diag, squares in LONG_DIAGONALS.items()
        },
    }


def _diagonal_control(board: chess.Board, squares: list[chess.Square]) -> str:
    """Side attacking ≥2 more diagonal squares than the other; else contested."""
    counts = {
        color: sum(1 for s in squares if board.attackers(color, s))
        for color in (chess.WHITE, chess.BLACK)
    }
    diff = counts[chess.WHITE] - counts[chess.BLACK]
    if diff >= 2:
        return "white"
    if diff <= -2:
        return "black"
    return "contested"
