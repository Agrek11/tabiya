"""Group 7 — tactics-adjacent geometry (design-4b §definitions).

FACTS, not evaluations: pins, x-rays, overloads, discovered candidates,
en-prise. The 4c motif DETECTOR builds judgments on top of these.
"""

from __future__ import annotations

from typing import Any

import chess

from .util import PIECE_VALUES_CP, piece_ref

SLIDERS = (chess.BISHOP, chess.ROOK, chess.QUEEN)


def tactics_geometry(board: chess.Board) -> dict[str, Any]:
    pins, xrays = _pins_and_xrays(board)
    return {
        "pins": pins,
        "xrays": xrays,
        "overloaded": _overloaded(board),
        "discovered_candidates": _discovered_candidates(board),
        "en_prise": _en_prise(board),
    }


def _ray_between(a: chess.Square, b: chess.Square) -> list[chess.Square] | None:
    """Squares strictly between a and b if aligned on rank/file/diagonal."""
    if a == b:
        return None
    df = chess.square_file(b) - chess.square_file(a)
    dr = chess.square_rank(b) - chess.square_rank(a)
    if not (df == 0 or dr == 0 or abs(df) == abs(dr)):
        return None
    step_f = (df > 0) - (df < 0)
    step_r = (dr > 0) - (dr < 0)
    out = []
    f, r = chess.square_file(a) + step_f, chess.square_rank(a) + step_r
    while (f, r) != (chess.square_file(b), chess.square_rank(b)):
        out.append(chess.square(f, r))
        f, r = f + step_f, r + step_r
    return out


def _slides_along(piece_type: chess.PieceType, a: chess.Square, b: chess.Square) -> bool:
    df = abs(chess.square_file(b) - chess.square_file(a))
    dr = abs(chess.square_rank(b) - chess.square_rank(a))
    diagonal = df == dr
    straight = df == 0 or dr == 0
    return (
        (piece_type == chess.BISHOP and diagonal)
        or (piece_type == chess.ROOK and straight)
        or (piece_type == chess.QUEEN and (diagonal or straight))
    )


def _pins_and_xrays(board: chess.Board) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """One alignment scan yields both: slider → exactly one interposed piece →
    valuable target. Interposed enemy piece + target more valuable (or king)
    = pin; interposed piece of EITHER color otherwise = x-ray."""
    pins: list[dict[str, Any]] = []
    xrays: list[dict[str, Any]] = []
    for color in (chess.WHITE, chess.BLACK):
        for slider_type in SLIDERS:
            for slider in board.pieces(slider_type, color):
                for target_type in (chess.KING, chess.QUEEN, chess.ROOK):
                    for target in board.pieces(target_type, not color):
                        if not _slides_along(slider_type, slider, target):
                            continue
                        between = _ray_between(slider, target)
                        if between is None:
                            continue
                        interposed = [s for s in between if board.piece_at(s)]
                        if len(interposed) != 1:
                            continue
                        mid = interposed[0]
                        mid_piece = board.piece_at(mid)
                        assert mid_piece is not None
                        entry = {
                            "by": piece_ref(board, slider),
                            "target": piece_ref(board, target),
                        }
                        if (
                            mid_piece.color != color
                            and PIECE_VALUES_CP[mid_piece.piece_type]
                            < PIECE_VALUES_CP[target_type]
                            + (10_000 if target_type == chess.KING else 0)
                            and mid_piece.piece_type != chess.KING
                        ):
                            pins.append(
                                {
                                    "pinned": piece_ref(board, mid),
                                    "to": piece_ref(board, target),
                                    "by": piece_ref(board, slider),
                                    "absolute": target_type == chess.KING,
                                }
                            )
                        else:
                            xrays.append({**entry, "through": piece_ref(board, mid)})
    key = lambda d: (d.get("by", ""), d.get("pinned", d.get("through", "")))  # noqa: E731
    return sorted(pins, key=key), sorted(xrays, key=key)


def _overloaded(board: chess.Board) -> list[dict[str, Any]]:
    """Piece that is the SOLE defender of ≥2 own pieces that are attacked."""
    result = []
    for color in (chess.WHITE, chess.BLACK):
        for defender_sq, defender in board.piece_map().items():
            if defender.color != color or defender.piece_type == chess.KING:
                continue
            duties = []
            for protected in board.attacks(defender_sq):
                target = board.piece_at(protected)
                if not target or target.color != color:
                    continue
                if not board.attackers(not color, protected):
                    continue  # not under attack — no duty
                defenders = board.attackers(color, protected)
                if set(defenders) == {defender_sq}:
                    duties.append(chess.square_name(protected))
            if len(duties) >= 2:
                result.append({"piece": piece_ref(board, defender_sq), "defends": sorted(duties)})
    return sorted(result, key=lambda d: d["piece"])


def _discovered_candidates(board: chess.Board) -> list[dict[str, Any]]:
    """Own piece whose departure opens an own-slider attack on enemy K/Q/R."""
    result = []
    for color in (chess.WHITE, chess.BLACK):
        for slider_type in SLIDERS:
            for slider in board.pieces(slider_type, color):
                for target_type in (chess.KING, chess.QUEEN, chess.ROOK):
                    for target in board.pieces(target_type, not color):
                        if not _slides_along(slider_type, slider, target):
                            continue
                        between = _ray_between(slider, target)
                        if between is None:
                            continue
                        interposed = [s for s in between if board.piece_at(s)]
                        if len(interposed) != 1:
                            continue
                        mover = board.piece_at(interposed[0])
                        assert mover is not None
                        if mover.color == color and mover.piece_type != chess.KING:
                            result.append(
                                {
                                    "mover": piece_ref(board, interposed[0]),
                                    "battery_piece": piece_ref(board, slider),
                                    "target": piece_ref(board, target),
                                }
                            )
    return sorted(result, key=lambda d: (d["mover"], d["battery_piece"]))


def _en_prise(board: chess.Board) -> list[str]:
    """Pieces attacked more times than defended (count comparison only —
    NOT a SEE evaluation; 4c judges captures, this just states geometry)."""
    result = []
    for square, piece in board.piece_map().items():
        if piece.piece_type == chess.KING:
            continue
        attackers = len(board.attackers(not piece.color, square))
        defenders = len(board.attackers(piece.color, square))
        if attackers > defenders:
            result.append(piece_ref(board, square))
    return sorted(result)
