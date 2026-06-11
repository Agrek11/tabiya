"""Shared helpers for the feature extractor modules."""

from __future__ import annotations

import chess

COLOR_NAMES: dict[chess.Color, str] = {chess.WHITE: "white", chess.BLACK: "black"}

PIECE_VALUES_CP: dict[chess.PieceType, int] = {
    chess.PAWN: 100,
    chess.KNIGHT: 300,
    chess.BISHOP: 300,
    chess.ROOK: 500,
    chess.QUEEN: 900,
    chess.KING: 0,
}

PIECE_LETTERS: dict[chess.PieceType, str] = {
    chess.PAWN: "",
    chess.KNIGHT: "N",
    chess.BISHOP: "B",
    chess.ROOK: "R",
    chess.QUEEN: "Q",
    chess.KING: "K",
}


def sq(square: chess.Square) -> str:
    return chess.square_name(square)


def piece_ref(board: chess.Board, square: chess.Square) -> str:
    """Human ref like 'Nf6' / pawn 'e5' for the piece on a square."""
    piece = board.piece_at(square)
    assert piece is not None
    return f"{PIECE_LETTERS[piece.piece_type]}{sq(square)}"


def pawns_of(board: chess.Board, color: chess.Color) -> list[chess.Square]:
    return sorted(board.pieces(chess.PAWN, color))


def files_with_pawns(board: chess.Board, color: chess.Color) -> set[int]:
    return {chess.square_file(s) for s in pawns_of(board, color)}


def squares_sorted(squares: set[chess.Square] | list[chess.Square]) -> list[str]:
    """Deterministic a1→h8 ordering (rank-major, matching square index)."""
    return [chess.square_name(s) for s in sorted(squares)]


def ahead_ranks(rank: int, color: chess.Color) -> range:
    """Ranks strictly in front of `rank` from `color`'s perspective."""
    return range(rank + 1, 8) if color == chess.WHITE else range(rank - 1, -1, -1)
