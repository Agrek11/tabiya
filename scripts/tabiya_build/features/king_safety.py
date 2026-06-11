"""Group 3 — king safety (design-4b §definitions)."""

from __future__ import annotations

from typing import Any

import chess

from .util import COLOR_NAMES


def king_safety(board: chess.Board) -> dict[str, Any]:
    return {name: _for_color(board, color) for color, name in COLOR_NAMES.items()}


def _for_color(board: chess.Board, color: chess.Color) -> dict[str, Any]:
    king = board.king(color)
    assert king is not None
    castled = _castled_status(board, color, king)
    return {
        "castled": castled,
        "shield": _shield(board, color, king) if castled in ("short", "long") else "n/a",
        "adjacent_open_files": _adjacent_files(board, king, kind="open"),
        "adjacent_half_open_files": _adjacent_files(board, king, kind="half-open", color=color),
        "king_zone_attackers": _zone_attackers(board, color, king),
    }


def _castled_status(board: chess.Board, color: chess.Color, king: chess.Square) -> str:
    """short/long when the king sits on a typical castled square with no
    castling rights remaining; 'none' otherwise (rights string still tells
    whether castling is still possible)."""
    if board.has_castling_rights(color):
        return "none"
    file = chess.square_file(king)
    back = 0 if color == chess.WHITE else 7
    if chess.square_rank(king) != back:
        return "none"
    if file >= 5:
        return "short"
    if file <= 2:
        return "long"
    return "none"


def _shield(board: chess.Board, color: chess.Color, king: chess.Square) -> str:
    """intact: all 3 front pawns on start rank or advanced one; one-breach:
    exactly one missing/advanced-2+; shattered otherwise."""
    direction = 1 if color == chess.WHITE else -1
    start_rank = 1 if color == chess.WHITE else 6
    file = chess.square_file(king)
    breaches = 0
    for f in (file - 1, file, file + 1):
        if not 0 <= f <= 7:
            continue
        ok = False
        for r in (start_rank, start_rank + direction):
            piece = board.piece_at(chess.square(f, r))
            if piece and piece.piece_type == chess.PAWN and piece.color == color:
                ok = True
                break
        if not ok:
            breaches += 1
    return "intact" if breaches == 0 else "one-breach" if breaches == 1 else "shattered"


def _adjacent_files(
    board: chess.Board,
    king: chess.Square,
    *,
    kind: str,
    color: chess.Color | None = None,
) -> list[str]:
    result = []
    for f in range(max(0, chess.square_file(king) - 1), min(7, chess.square_file(king) + 1) + 1):
        white_pawns = any(
            chess.square_file(s) == f for s in board.pieces(chess.PAWN, chess.WHITE)
        )
        black_pawns = any(
            chess.square_file(s) == f for s in board.pieces(chess.PAWN, chess.BLACK)
        )
        if kind == "open" and not white_pawns and not black_pawns:
            result.append(chess.FILE_NAMES[f])
        elif kind == "half-open" and color is not None:
            own = white_pawns if color == chess.WHITE else black_pawns
            other = black_pawns if color == chess.WHITE else white_pawns
            if not own and other:
                result.append(chess.FILE_NAMES[f])
    return result


def _zone_attackers(board: chess.Board, color: chess.Color, king: chess.Square) -> int:
    """Count of distinct enemy pieces (incl. pawns) attacking any square of
    the king zone: 3×3 around the king + the 3 squares two ranks toward the
    enemy side."""
    direction = 1 if color == chess.WHITE else -1
    file, rank = chess.square_file(king), chess.square_rank(king)
    zone: set[chess.Square] = set()
    for df in (-1, 0, 1):
        for dr in (-1, 0, 1, 2 * direction):
            f, r = file + df, rank + dr
            if 0 <= f <= 7 and 0 <= r <= 7:
                zone.add(chess.square(f, r))
    attackers: set[chess.Square] = set()
    for square in zone:
        attackers |= set(board.attackers(not color, square))
    return len(attackers)
