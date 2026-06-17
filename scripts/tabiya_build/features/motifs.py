"""4c.1 — validated motif detection (design requirements-4c1.md).

Turns raw geometry into NAMED motifs with a static-validation confidence tag.
Geometry alone is untrustworthy (a fork that hangs the forker is not a fork);
the value here is the validation. STATIC only (material + attacker/defender
counts + 1-ply SEE-lite on the key square) — deep refutations are the 4c.2
engine-cross-check's job. Openings are shallow-tactic, so static catches most.

Output shape (added to PositionFeatures as `motifs`):
  {
    "forks":      [{ "by": "Nd5", "targets": ["Ra8","Bc7"], "confidence": "high" }],
    "skewers":    [{ "by": "Bb5", "front": "Qe8", "back": "Ke8"... }],
    "batteries":  [{ "pieces": ["Qd1","Rd3"], "line": "d-file", "target": "Qd8" }],
    "pins":       [ ... promoted from geometry ... ],
    "discovered": [ ... ],
    "removing_defender": [{ "defender": "Nf3", "abandons": ["e5","h2"] }],
    "hanging":    [{ "piece": "Be6", "by": "Nd4" }]
  }
All lists deterministic-sorted; empty lists kept for shape stability.
"""

from __future__ import annotations

from typing import Any

import chess

from .tactics_geometry import _ray_between, _slides_along, _overloaded, _pins_and_xrays
from .util import PIECE_VALUES_CP, piece_ref

SLIDERS = (chess.BISHOP, chess.ROOK, chess.QUEEN)
HIGH = "high"
SPEC = "speculative"


def motifs(board: chess.Board) -> dict[str, Any]:
    pins, _xrays = _pins_and_xrays(board)
    return {
        "forks": _forks(board),
        "skewers": _skewers(board),
        "batteries": _batteries(board),
        "pins": [
            {"by": p["by"], "pinned": p["pinned"], "to": p["to"],
             "kind": "absolute" if p["absolute"] else "relative", "confidence": HIGH}
            for p in pins
        ],
        "removing_defender": _removing_defender(board),
        "hanging": _hanging(board),
    }


# --- static validation helpers ---------------------------------------------

def _value(board: chess.Board, sq: chess.Square) -> int:
    piece = board.piece_at(sq)
    return PIECE_VALUES_CP[piece.piece_type] if piece else 0


def _piece_safe(board: chess.Board, sq: chess.Square) -> bool:
    """A piece is safe on its square if no enemy attacks it, or it is defended
    and its cheapest attacker is worth at least as much (trading down is not
    losing). 1-ply SEE-lite."""
    piece = board.piece_at(sq)
    if piece is None:
        return False
    enemy = not piece.color
    attackers = board.attackers(enemy, sq)
    if not attackers:
        return True
    defenders = board.attackers(piece.color, sq)
    if not defenders:
        return False
    cheapest = min(_value(board, a) for a in attackers)
    return cheapest >= _value(board, sq)


def _is_hanging(board: chess.Board, target: chess.Square, by_color: chess.Color) -> bool:
    """A piece hangs when it will actually be lost — STATIC heuristic: it is
    attacked AND (undefended, OR more attackers than defenders, OR its cheapest
    attacker is worth strictly less than it so the capture wins material). An
    equal, fully-defended trade (knight takes a once-defended knight) is NOT
    hanging — that was the over-firing bug."""
    attackers = board.attackers(by_color, target)
    if not attackers:
        return False
    defenders = board.attackers(not by_color, target)
    if not defenders:
        return True
    cheapest = min(_value(board, a) for a in attackers)
    return len(attackers) > len(defenders) or cheapest < _value(board, target)


# --- motifs -----------------------------------------------------------------

def _is_valuable_target(board: chess.Board, sq: chess.Square, attacker_color: chess.Color) -> bool:
    piece = board.piece_at(sq)
    if piece is None or piece.color == attacker_color:
        return False
    if piece.piece_type == chess.PAWN:
        # only an undefended pawn counts as a fork target
        return not board.attackers(piece.color, sq)
    return True  # any piece or king


def _forks(board: chess.Board) -> list[dict[str, Any]]:
    out = []
    for sq, piece in board.piece_map().items():
        if piece.piece_type in (chess.KING,):
            continue
        targets = sorted(
            t for t in board.attacks(sq) if _is_valuable_target(board, t, piece.color)
        )
        # count "valuable enough": pieces (non-pawn) + king; need ≥2 with at
        # least one a real piece (pawn-only double-attack is weak).
        strong = [t for t in targets if (board.piece_at(t) and board.piece_at(t).piece_type != chess.PAWN)]  # type: ignore[union-attr]
        if len(targets) >= 2 and len(strong) >= 1:
            out.append(
                {
                    "by": piece_ref(board, sq),
                    "targets": [piece_ref(board, t) for t in targets],
                    "confidence": HIGH if _piece_safe(board, sq) else SPEC,
                }
            )
    return sorted(out, key=lambda m: m["by"])


def _skewers(board: chess.Board) -> list[dict[str, Any]]:
    out = []
    for color in (chess.WHITE, chess.BLACK):
        for slider_type in SLIDERS:
            for slider in board.pieces(slider_type, color):
                for front_type in (chess.QUEEN, chess.ROOK, chess.BISHOP, chess.KING):
                    for front in board.pieces(front_type, not color):
                        if not _slides_along(slider_type, slider, front):
                            continue
                        between = _ray_between(slider, front)
                        if between is None or any(board.piece_at(s) for s in between):
                            continue  # front must be the first piece hit
                        back = _first_behind(board, slider, front, not color)
                        if back is None:
                            continue
                        # A king in front is the definitional skewer (it must
                        # move, exposing the piece behind). Otherwise the front
                        # piece must outweigh the rear. KING's table value is 0,
                        # so it must be special-cased here.
                        front_is_king = front_type == chess.KING
                        if front_is_king or _value(board, front) > _value(board, back):
                            out.append(
                                {
                                    "by": piece_ref(board, slider),
                                    "front": piece_ref(board, front),
                                    "back": piece_ref(board, back),
                                    "confidence": HIGH,
                                }
                            )
    return sorted(out, key=lambda m: (m["by"], m["front"]))


def _first_behind(
    board: chess.Board, slider: chess.Square, front: chess.Square, color: chess.Color
) -> chess.Square | None:
    """First piece of `color` continuing past `front` away from `slider`."""
    df = (chess.square_file(front) - chess.square_file(slider))
    dr = (chess.square_rank(front) - chess.square_rank(slider))
    step_f = (df > 0) - (df < 0)
    step_r = (dr > 0) - (dr < 0)
    f, r = chess.square_file(front) + step_f, chess.square_rank(front) + step_r
    while 0 <= f <= 7 and 0 <= r <= 7:
        piece = board.piece_at(chess.square(f, r))
        if piece is not None:
            return chess.square(f, r) if piece.color == color else None
        f, r = f + step_f, r + step_r
    return None


def _batteries(board: chess.Board) -> list[dict[str, Any]]:
    """Two own line-pieces stacked on one line, clear between them, the line
    extended hitting an enemy piece or the enemy king."""
    out = []
    for color in (chess.WHITE, chess.BLACK):
        line_pieces = [
            s
            for s in board.piece_map()
            if board.piece_at(s).color == color  # type: ignore[union-attr]
            and board.piece_at(s).piece_type in SLIDERS  # type: ignore[union-attr]
        ]
        for i in range(len(line_pieces)):
            for j in range(i + 1, len(line_pieces)):
                a, b = line_pieces[i], line_pieces[j]
                ta = board.piece_at(a).piece_type  # type: ignore[union-attr]
                tb = board.piece_at(b).piece_type  # type: ignore[union-attr]
                if not (_slides_along(ta, a, b) and _slides_along(tb, a, b)):
                    continue
                between = _ray_between(a, b)
                if between is None or any(board.piece_at(s) for s in between):
                    continue
                # rear piece is the one farther from the enemy king on this line
                target = _battery_target(board, a, b, color)
                if target is None:
                    continue
                pieces = sorted([piece_ref(board, a), piece_ref(board, b)])
                out.append({"pieces": pieces, "target": piece_ref(board, target), "confidence": HIGH})
    return sorted(out, key=lambda m: tuple(m["pieces"]))


def _battery_target(
    board: chess.Board, a: chess.Square, b: chess.Square, color: chess.Color
) -> chess.Square | None:
    """First enemy piece hit by extending the a–b line in either direction."""
    for front, rear in ((a, b), (b, a)):
        df = chess.square_file(front) - chess.square_file(rear)
        dr = chess.square_rank(front) - chess.square_rank(rear)
        step_f = (df > 0) - (df < 0)
        step_r = (dr > 0) - (dr < 0)
        f, r = chess.square_file(front) + step_f, chess.square_rank(front) + step_r
        while 0 <= f <= 7 and 0 <= r <= 7:
            piece = board.piece_at(chess.square(f, r))
            if piece is not None:
                if piece.color != color:
                    return chess.square(f, r)
                break
            f, r = f + step_f, r + step_r
    return None


def _removing_defender(board: chess.Board) -> list[dict[str, Any]]:
    return [
        {"defender": o["piece"], "abandons": o["defends"], "confidence": HIGH}
        for o in _overloaded(board)
    ]


def _hanging(board: chess.Board) -> list[dict[str, Any]]:
    """En-prise PIECES (not pawns) the enemy can actually win (SEE-lite ≥0)."""
    out = []
    for sq, piece in board.piece_map().items():
        if piece.piece_type in (chess.KING, chess.PAWN):
            continue
        enemy = not piece.color
        if _is_hanging(board, sq, enemy):
            attacker = min(board.attackers(enemy, sq), key=lambda a: _value(board, a))
            out.append({"piece": piece_ref(board, sq), "by": piece_ref(board, attacker), "confidence": HIGH})
    return sorted(out, key=lambda m: m["piece"])
