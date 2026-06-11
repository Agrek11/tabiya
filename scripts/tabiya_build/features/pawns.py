"""Group 2 — pawn structure (design-4b §definitions).

Every helper is a pure function of the board; ambiguity is pinned by the
golden fixtures in evals/features/golden/ (the spec of record).
"""

from __future__ import annotations

from typing import Any

import chess

from .util import COLOR_NAMES, ahead_ranks, files_with_pawns, pawns_of, squares_sorted


def pawn_structure(board: chess.Board) -> dict[str, Any]:
    per_color = {
        "doubled": _per_color(board, _doubled),
        "isolated": _per_color(board, _isolated),
        "backward": _per_color(board, _backward),
        "passed": _per_color(board, _passed),
        "candidate_passers": _per_color(board, _candidate_passers),
    }
    return {
        **per_color,
        "islands": {name: _islands(board, color) for color, name in COLOR_NAMES.items()},
        "chains": {name: _chains(board, color) for color, name in COLOR_NAMES.items()},
        "majorities": _majorities(board),
        "iqp": _iqp(board),
        "hanging_duo": _hanging_duo(board),
    }


def _per_color(board: chess.Board, fn) -> dict[str, list[str]]:  # noqa: ANN001
    return {name: squares_sorted(fn(board, color)) for color, name in COLOR_NAMES.items()}


def _doubled(board: chess.Board, color: chess.Color) -> list[chess.Square]:
    by_file: dict[int, list[chess.Square]] = {}
    for square in pawns_of(board, color):
        by_file.setdefault(chess.square_file(square), []).append(square)
    return [s for squares in by_file.values() if len(squares) >= 2 for s in squares]


def _isolated(board: chess.Board, color: chess.Color) -> list[chess.Square]:
    files = files_with_pawns(board, color)
    return [
        s
        for s in pawns_of(board, color)
        if not ({chess.square_file(s) - 1, chess.square_file(s) + 1} & files)
    ]


def _passed(board: chess.Board, color: chess.Color) -> list[chess.Square]:
    enemy = pawns_of(board, not color)
    result = []
    for square in pawns_of(board, color):
        file, rank = chess.square_file(square), chess.square_rank(square)
        blockers = [
            e
            for e in enemy
            if abs(chess.square_file(e) - file) <= 1
            and chess.square_rank(e) in ahead_ranks(rank, color)
        ]
        if not blockers:
            result.append(square)
    return result


def _backward(board: chess.Board, color: chess.Color) -> list[chess.Square]:
    """Stop-square attacked by an enemy pawn AND no own pawn on an adjacent
    file at equal-or-lesser advancement (own perspective). Rim files included."""
    own = pawns_of(board, color)
    direction = 1 if color == chess.WHITE else -1
    result = []
    for square in own:
        file, rank = chess.square_file(square), chess.square_rank(square)
        stop_rank = rank + direction
        if not 0 <= stop_rank <= 7:
            continue
        stop = chess.square(file, stop_rank)
        attacked_by_enemy_pawn = any(
            board.piece_at(a)
            and board.piece_at(a).piece_type == chess.PAWN  # type: ignore[union-attr]
            for a in board.attackers(not color, stop)
        )
        if not attacked_by_enemy_pawn:
            continue
        advancement = rank if color == chess.WHITE else 7 - rank
        has_support_peer = any(
            abs(chess.square_file(p) - file) == 1
            and (
                (chess.square_rank(p) if color == chess.WHITE else 7 - chess.square_rank(p))
                <= advancement
            )
            for p in own
        )
        if not has_support_peer:
            result.append(square)
    return result


def _candidate_passers(board: chess.Board, color: chess.Color) -> list[chess.Square]:
    """Standard candidate rule on the pawn's path: not passed, no enemy pawn
    directly ahead on the SAME file, and own supporting pawns on adjacent
    files (count, from this rank back) ≥ enemy guarding pawns ahead on
    adjacent files."""
    passed = set(_passed(board, color))
    enemy = pawns_of(board, not color)
    own = pawns_of(board, color)
    result = []
    for square in own:
        if square in passed:
            continue
        file, rank = chess.square_file(square), chess.square_rank(square)
        ahead = set(ahead_ranks(rank, color))
        if any(chess.square_file(e) == file and chess.square_rank(e) in ahead for e in enemy):
            continue
        guards = sum(
            1
            for e in enemy
            if abs(chess.square_file(e) - file) == 1 and chess.square_rank(e) in ahead
        )
        supporters = sum(
            1
            for p in own
            if abs(chess.square_file(p) - file) == 1 and chess.square_rank(p) not in ahead
        )
        if supporters >= guards:
            result.append(square)
    return result


def _islands(board: chess.Board, color: chess.Color) -> int:
    files = sorted(files_with_pawns(board, color))
    if not files:
        return 0
    islands = 1
    for prev, cur in zip(files, files[1:]):
        if cur - prev > 1:
            islands += 1
    return islands


def _chains(board: chess.Board, color: chess.Color) -> list[dict[str, str]]:
    """Maximal diagonal runs (≥2) where each pawn defends the next; base =
    rearmost pawn of the run, head = foremost."""
    own = set(pawns_of(board, color))
    direction = 1 if color == chess.WHITE else -1
    links: dict[chess.Square, list[chess.Square]] = {}
    for p in own:
        file, rank = chess.square_file(p), chess.square_rank(p)
        for df in (-1, 1):
            f, r = file + df, rank + direction
            if 0 <= f <= 7 and 0 <= r <= 7 and chess.square(f, r) in own:
                links.setdefault(p, []).append(chess.square(f, r))

    defended = {d for ds in links.values() for d in ds}
    chains: list[dict[str, str]] = []
    for base in sorted(own - defended):  # chain bases: pawns no own pawn defends
        # Follow the longest single link path (golden fixtures pin branching cases).
        path = [base]
        while path[-1] in links:
            path.append(sorted(links[path[-1]])[0])
        if len(path) >= 2:
            chains.append(
                {"base": chess.square_name(base), "head": chess.square_name(path[-1])}
            )
    return sorted(chains, key=lambda c: c["base"])


_WINGS = {"queenside": range(0, 3), "kingside": range(5, 8), "center": range(3, 5)}


def _majorities(board: chess.Board) -> dict[str, str | None]:
    result: dict[str, str | None] = {}
    for wing, files in _WINGS.items():
        white = sum(1 for p in pawns_of(board, chess.WHITE) if chess.square_file(p) in files)
        black = sum(1 for p in pawns_of(board, chess.BLACK) if chess.square_file(p) in files)
        result[wing] = "white" if white > black else "black" if black > white else None
    return result


def _iqp(board: chess.Board) -> str | None:
    for color, name in COLOR_NAMES.items():
        isolated = _isolated(board, color)
        d_isolated = [s for s in isolated if chess.square_file(s) == 3]
        if d_isolated and len([s for s in pawns_of(board, color) if chess.square_file(s) == 3]) == 1:
            return name
    return None


def _hanging_duo(board: chess.Board) -> str | None:
    """Classic c+d duo: own pawns side-by-side on c and d files on the same
    rank, no own pawns on b or e files (fixture-pinned definition)."""
    for color, name in COLOR_NAMES.items():
        files = files_with_pawns(board, color)
        if 2 not in files or 3 not in files or 1 in files or 4 in files:
            continue
        c_pawns = [s for s in pawns_of(board, color) if chess.square_file(s) == 2]
        d_pawns = [s for s in pawns_of(board, color) if chess.square_file(s) == 3]
        if len(c_pawns) == 1 and len(d_pawns) == 1 and (
            chess.square_rank(c_pawns[0]) == chess.square_rank(d_pawns[0])
        ):
            return name
    return None
