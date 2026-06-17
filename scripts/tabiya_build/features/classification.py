"""4c.2 — position classification (design requirements-4c2.md).

Names the TYPE of position (center character + crisp pawn-structure labels) so
the coach frames the right kind of advice. Scope discipline: only crisp,
deterministic judgments — a wrong structure label is worse than silence, so
named structures emit ONLY on exact pattern match.
"""

from __future__ import annotations

from typing import Any

import chess

from .center_space import CENTER, _locked
from .util import COLOR_NAMES, files_with_pawns, pawns_of

# Re-expose for callers that pass an already-computed pawn-structure dict.


def classification(board: chess.Board) -> dict[str, Any]:
    return {
        "center": _center(board),
        "structures": _structures(board),
        "character": _character(board),
    }


# --- center type ------------------------------------------------------------

def _center_pawns(board: chess.Board) -> list[chess.Square]:
    return [s for s in CENTER if (p := board.piece_at(s)) and p.piece_type == chess.PAWN]


def _center_capture_available(board: chess.Board) -> bool:
    """Any pawn capture touching a center square (tension)."""
    for sq in CENTER:
        piece = board.piece_at(sq)
        if not piece or piece.piece_type != chess.PAWN:
            continue
        for target in board.attacks(sq):
            victim = board.piece_at(target)
            if victim and victim.color != piece.color and victim.piece_type == chess.PAWN:
                return True
    return False


def _central_open_files(board: chess.Board) -> list[str]:
    out = []
    for f in (3, 4):  # d, e
        if not any(chess.square_file(s) == f for s in board.pieces(chess.PAWN, chess.WHITE)) and \
           not any(chess.square_file(s) == f for s in board.pieces(chess.PAWN, chess.BLACK)):
            out.append(chess.FILE_NAMES[f])
    return out


def _pawns_in_contact(board: chess.Board) -> bool:
    """Center pawns in contact: either head-to-head blocked on a file (white
    pawn directly behind a black pawn — the classic fixed-chain lock, e.g.
    e4/e5 + d5/d6 in a King's Indian) or diagonally facing across the center."""
    for sq in CENTER:
        piece = board.piece_at(sq)
        if not piece or piece.piece_type != chess.PAWN:
            continue
        # head-to-head block
        ahead_rank = chess.square_rank(sq) + (1 if piece.color == chess.WHITE else -1)
        if 0 <= ahead_rank <= 7:
            front = board.piece_at(chess.square(chess.square_file(sq), ahead_rank))
            if front and front.piece_type == chess.PAWN and front.color != piece.color:
                return True
        # diagonal contact
        for target in board.attacks(sq):
            victim = board.piece_at(target)
            if victim and victim.piece_type == chess.PAWN and victim.color != piece.color:
                return True
    return False


def _center(board: chess.Board) -> dict[str, Any]:
    central = _center_pawns(board)
    open_central = _central_open_files(board)
    if _locked(board):
        ctype = "closed"
    elif _center_capture_available(board):
        ctype = "tension"
    elif len(central) <= 1 and open_central:
        ctype = "open"
    elif _pawns_in_contact(board):
        ctype = "fixed"
    else:
        ctype = "fluid"

    wspace = _space(board, chess.WHITE)
    bspace = _space(board, chess.BLACK)
    edge = "white" if wspace - bspace >= 4 else "black" if bspace - wspace >= 4 else None
    return {"type": ctype, "open_files_central": open_central, "space_edge": edge}


def _space(board: chess.Board, color: chess.Color) -> int:
    enemy_half = range(32, 64) if color == chess.WHITE else range(0, 32)
    attacked: set[chess.Square] = set()
    for pawn in board.pieces(chess.PAWN, color):
        attacked |= set(board.attacks(pawn))
    return len([s for s in attacked if s in enemy_half])


# --- named structures (exact match only) ------------------------------------

def _has(board: chess.Board, color: chess.Color, square_name: str) -> bool:
    sq = chess.parse_square(square_name)
    p = board.piece_at(sq)
    return bool(p and p.color == color and p.piece_type == chess.PAWN)


def _structures(board: chess.Board) -> list[str]:
    from .pawns import _iqp, _hanging_duo  # local import avoids a cycle at load

    out: list[str] = []
    if _iqp(board) is not None:
        out.append("isolated-queens-pawn")
    if _hanging_duo(board) is not None:
        out.append("hanging-pawns")

    # Maroczy bind: c4 + e4 pawns AND NO own d-pawn (the d-file is open — what
    # distinguishes a true Maroczy from a King's-Indian-style c4+d5+e4 wall),
    # opponent not contesting with a c/d pawn on the bind rank.
    for color, name in COLOR_NAMES.items():
        cfile, efile = ("c4", "e4") if color == chess.WHITE else ("c5", "e5")
        own_d = {"d4", "d5"} if color == chess.WHITE else {"d4", "d5"}
        has_own_d = any(_has(board, color, s) for s in own_d)
        if _has(board, color, cfile) and _has(board, color, efile) and not has_own_d:
            enemy = not color
            contest = {"d5", "c5"} if color == chess.WHITE else {"d4", "c4"}
            if not any(_has(board, enemy, s) for s in contest):
                out.append(f"maroczy-bind-{name}")

    # Stonewall: the c3/d4/e3/f4 wall (white) or c6/d5/e6/f5 (black).
    for color, name in COLOR_NAMES.items():
        wall = ("c3", "d4", "e3", "f4") if color == chess.WHITE else ("c6", "d5", "e6", "f5")
        if all(_has(board, color, s) for s in wall):
            out.append(f"stonewall-{name}")

    # Locked chain: closed center + a pawn chain ≥3 long either side.
    if _locked(board) and any(
        _chain_len(board, color) >= 3 for color in (chess.WHITE, chess.BLACK)
    ):
        out.append("locked-chain")

    if _symmetric(board):
        out.append("symmetric")

    return sorted(set(out))


def _chain_len(board: chess.Board, color: chess.Color) -> int:
    from .pawns import _chains

    chains = _chains(board, color)
    best = 0
    for c in chains:
        # base→head spans (rank distance + 1) pawns on a diagonal.
        base = chess.parse_square(c["base"])
        head = chess.parse_square(c["head"])
        best = max(best, abs(chess.square_rank(head) - chess.square_rank(base)) + 1)
    return best


def _symmetric(board: chess.Board) -> bool:
    """TRUE positional mirror: every white pawn on (file, rank) has a black
    pawn on (file, 7-rank). File-count parity is not enough — most opening
    positions have one pawn per file yet are not symmetric."""
    white = pawns_of(board, chess.WHITE)
    black = {chess.square(chess.square_file(s), 7 - chess.square_rank(s)) for s in pawns_of(board, chess.BLACK)}
    return len(white) > 0 and set(white) == black


# --- game character (soft descriptor) ---------------------------------------

def _character(board: chess.Board) -> str:
    ctype = _center(board)["type"]
    w_castled = not board.has_castling_rights(chess.WHITE)
    b_castled = not board.has_castling_rights(chess.BLACK)
    asymmetric_kings = w_castled != b_castled
    if ctype in ("open", "tension") and asymmetric_kings:
        return "sharp-imbalanced"
    if ctype == "open":
        return "open-tactical"
    if ctype in ("closed", "fixed"):
        return "closed-maneuvering"
    return "balanced"
