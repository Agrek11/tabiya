"""Group 6 — piece placement & activity (design-4b §definitions)."""

from __future__ import annotations

from typing import Any

import chess

from .util import COLOR_NAMES, piece_ref, squares_sorted

HOME_MINORS = {
    chess.WHITE: {chess.B1: chess.KNIGHT, chess.G1: chess.KNIGHT, chess.C1: chess.BISHOP, chess.F1: chess.BISHOP},
    chess.BLACK: {chess.B8: chess.KNIGHT, chess.G8: chess.KNIGHT, chess.C8: chess.BISHOP, chess.F8: chess.BISHOP},
}

FIANCHETTO = {
    chess.WHITE: {chess.G2: ("f2", "g3", "h2"), chess.B2: ("a2", "b3", "c2")},
    chess.BLACK: {chess.G7: ("f7", "g6", "h7"), chess.B7: ("a7", "b6", "c7")},
}


def activity(board: chess.Board) -> dict[str, Any]:
    return {
        "mobility": {name: _mobility(board, color) for color, name in COLOR_NAMES.items()},
        "outposts": {name: _outposts(board, color) for color, name in COLOR_NAMES.items()},
        "bad_bishop": {name: _bad_bishop(board, color) for color, name in COLOR_NAMES.items()},
        "fianchetto": {name: _fianchetto(board, color) for color, name in COLOR_NAMES.items()},
        "trapped": {name: _trapped(board, color) for color, name in COLOR_NAMES.items()},
        "undeveloped_minors": {
            name: _undeveloped(board, color) for color, name in COLOR_NAMES.items()
        },
        "tempo": _tempo(board),
    }


def _mobility(board: chess.Board, color: chess.Color) -> dict[str, list[int]]:
    """Pseudo-legal destination counts per piece type (own-occupied squares
    excluded; sorted per type for determinism)."""
    result: dict[str, list[int]] = {}
    for letter, piece_type in (
        ("N", chess.KNIGHT),
        ("B", chess.BISHOP),
        ("R", chess.ROOK),
        ("Q", chess.QUEEN),
    ):
        counts = sorted(
            sum(1 for t in board.attacks(square) if _not_own(board, color, t))
            for square in board.pieces(piece_type, color)
        )
        if counts:
            result[letter] = counts
    return result


def _not_own(board: chess.Board, color: chess.Color, target: chess.Square) -> bool:
    piece = board.piece_at(target)
    return piece is None or piece.color != color


def _pawn_defends(board: chess.Board, square: chess.Square, color: chess.Color) -> bool:
    return any(
        (p := board.piece_at(a)) and p.piece_type == chess.PAWN and p.color == color
        for a in board.attackers(color, square)
    )


def _pawn_could_attack(board: chess.Board, square: chess.Square, enemy: chess.Color) -> bool:
    """An enemy pawn on an adjacent file could ever advance to attack `square`."""
    file, rank = chess.square_file(square), chess.square_rank(square)
    direction = -1 if enemy == chess.WHITE else 1  # enemy pawns come FROM their side
    for f in (file - 1, file + 1):
        if not 0 <= f <= 7:
            continue
        r = rank + direction
        while 0 <= r <= 7:
            piece = board.piece_at(chess.square(f, r))
            if piece:
                if piece.piece_type == chess.PAWN and piece.color == enemy:
                    return True
                break
            r += direction
    return False


def _outposts(board: chess.Board, color: chess.Color) -> dict[str, list[str]]:
    enemy_half = range(32, 64) if color == chess.WHITE else range(0, 32)
    occupied: list[str] = []
    available: list[chess.Square] = []
    for square in enemy_half:
        if not _pawn_defends(board, square, color):
            continue
        if _pawn_could_attack(board, square, not color):
            continue
        piece = board.piece_at(square)
        if piece and piece.color == color and piece.piece_type in (chess.KNIGHT, chess.BISHOP):
            occupied.append(piece_ref(board, square))
        elif piece is None:
            available.append(square)
    return {"occupied": sorted(occupied), "available": squares_sorted(available)}


def _bad_bishop(board: chess.Board, color: chess.Color) -> str | None:
    """Own pawns on the bishop's color ≥4 AND ≥2 of them central (c-f files);
    returns the bishop's square or null. Single worst bishop reported."""
    for bishop in sorted(board.pieces(chess.BISHOP, color)):
        bishop_color = (chess.square_file(bishop) + chess.square_rank(bishop)) % 2
        same_color_pawns = [
            p
            for p in board.pieces(chess.PAWN, color)
            if (chess.square_file(p) + chess.square_rank(p)) % 2 == bishop_color
        ]
        central = [p for p in same_color_pawns if 2 <= chess.square_file(p) <= 5]
        if len(same_color_pawns) >= 4 and len(central) >= 2:
            return chess.square_name(bishop)
    return None


def _fianchetto(board: chess.Board, color: chess.Color) -> str | None:
    for square, shield in FIANCHETTO[color].items():
        piece = board.piece_at(square)
        if not (piece and piece.color == color and piece.piece_type == chess.BISHOP):
            continue
        intact = all(
            (p := board.piece_at(chess.parse_square(s))) is not None
            and p.piece_type == chess.PAWN
            and p.color == color
            for s in shield
        )
        return f"{'intact' if intact else 'broken'}-{chess.square_name(square)}"
    return None


def _trapped(board: chess.Board, color: chess.Color) -> list[str]:
    """Non-pawn, non-king piece with zero SAFE destinations: every reachable
    square is occupied by own piece or attacked by enemy and defended fewer
    times than attacked."""
    result = []
    for piece_type in (chess.KNIGHT, chess.BISHOP, chess.ROOK, chess.QUEEN):
        for square in board.pieces(piece_type, color):
            safe = False
            for target in board.attacks(square):
                occupant = board.piece_at(target)
                if occupant and occupant.color == color:
                    continue
                attackers = len(board.attackers(not color, target))
                defenders = len(board.attackers(color, target)) - 1  # minus itself moving there
                if attackers == 0 or defenders >= attackers:
                    safe = True
                    break
            if not safe:
                result.append(piece_ref(board, square))
    return sorted(result)


def _undeveloped(board: chess.Board, color: chess.Color) -> int:
    return sum(
        1
        for square, piece_type in HOME_MINORS[color].items()
        if (p := board.piece_at(square)) and p.color == color and p.piece_type == piece_type
    )


def _tempo(board: chess.Board) -> dict[str, str]:
    developed = {
        color: 4 - _undeveloped(board, color) + (1 if not board.has_castling_rights(color) else 0)
        for color in (chess.WHITE, chess.BLACK)
    }
    diff = developed[chess.WHITE] - developed[chess.BLACK]
    lead = "even" if diff == 0 else f"white+{diff}" if diff > 0 else f"black+{-diff}"
    return {
        "side_to_move": COLOR_NAMES[board.turn],
        "development_lead": lead,
    }
