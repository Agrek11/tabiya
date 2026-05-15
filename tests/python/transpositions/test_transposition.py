"""Transposition index: determinism, normalization, parity tests."""

from __future__ import annotations

import json
import re
from pathlib import Path

from scripts.tabiya_build.schema import Line
from scripts.tabiya_build.transposition import (
    build_transposition_index,
    fen_hash,
    normalize_fen,
    write_transposition_sidecar,
)

REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE = REPO_ROOT / "tests" / "fixtures" / "fen_hash_parity.json"


def _line(line_id: str, moves: list[str]) -> Line:
    import chess

    board = chess.Board()
    for san in moves:
        board.push_san(san)
    return Line(
        id=line_id,
        opening_id="x",
        name="X",
        moves=moves,
        depth=len(moves),
        end_fen=board.fen(),
        popularity=0.5,
    )


def test_normalize_fen_drops_counters() -> None:
    fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    assert normalize_fen(fen) == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -"


def test_fen_hash_ignores_counters() -> None:
    a = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
    b = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 99 50"
    assert fen_hash(a) == fen_hash(b)


def test_fen_hash_matches_parity_fixture() -> None:
    fixture = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert fixture["algo"] == "sha1-16"
    assert fixture["normalization"] == "drop-counters"
    for entry in fixture["fixtures"]:
        assert normalize_fen(entry["fen"]) == entry["normalized"]
        assert fen_hash(entry["fen"]) == entry["hash"]


def test_build_index_drops_singletons() -> None:
    # Line A: 1.e4 e5  → after e5 is unique to A
    # Line B: 1.e4 e5 2.Nf3 → branches off after e5, then unique to B
    line_a = _line("a", ["e4", "e5"])
    line_b = _line("b", ["e4", "e5", "Nf3"])
    index = build_transposition_index([line_a, line_b])
    # Position after 1...e5 is in BOTH lines → present
    import chess

    board = chess.Board()
    for san in ["e4", "e5"]:
        board.push_san(san)
    shared = fen_hash(board.fen())
    assert shared in index
    assert sorted(index[shared]) == ["a", "b"]
    # Position after 2.Nf3 is only in B → absent (singleton)
    board.push_san("Nf3")
    unique = fen_hash(board.fen())
    assert unique not in index


def test_build_index_sorts_line_ids_within_entry() -> None:
    line_z = _line("zebra", ["e4", "e5"])
    line_a = _line("alpha", ["e4", "e5"])
    line_m = _line("mike", ["e4", "e5"])
    index = build_transposition_index([line_z, line_a, line_m])
    import chess

    board = chess.Board()
    for san in ["e4", "e5"]:
        board.push_san(san)
    shared = fen_hash(board.fen())
    assert index[shared] == ["alpha", "mike", "zebra"]


def test_determinism_byte_equal_across_two_runs(tmp_path: Path) -> None:
    line_a = _line("a", ["e4", "e5", "Nf3"])
    line_b = _line("b", ["e4", "e5", "Bc4"])
    line_c = _line("c", ["e4", "e5"])

    out1 = tmp_path / "t1.json"
    out2 = tmp_path / "t2.json"

    idx1 = build_transposition_index([line_a, line_b, line_c])
    idx2 = build_transposition_index([line_a, line_b, line_c])
    assert idx1 == idx2

    write_transposition_sidecar(idx1, out1, generated_at="2026-05-15T00:00:00Z")
    write_transposition_sidecar(idx2, out2, generated_at="2026-05-15T00:00:00Z")

    # Byte-equal when generated_at is fixed
    assert out1.read_bytes() == out2.read_bytes()


def test_determinism_excluding_generated_at(tmp_path: Path) -> None:
    """Even with different generated_at timestamps, the rest of the file matches."""
    line_a = _line("a", ["e4", "e5"])
    line_b = _line("b", ["e4", "e5"])
    out1 = tmp_path / "t1.json"
    out2 = tmp_path / "t2.json"

    idx = build_transposition_index([line_a, line_b])
    write_transposition_sidecar(idx, out1, generated_at="2026-05-15T00:00:00Z")
    write_transposition_sidecar(idx, out2, generated_at="2026-05-15T12:00:00Z")

    body1 = re.sub(r'"generated_at":\s*"[^"]+"', "", out1.read_text())
    body2 = re.sub(r'"generated_at":\s*"[^"]+"', "", out2.read_text())
    assert body1 == body2


def test_sidecar_schema_fields(tmp_path: Path) -> None:
    line_a = _line("a", ["e4", "e5"])
    line_b = _line("b", ["e4", "e5"])
    out = tmp_path / "sidecar.json"
    write_transposition_sidecar(
        build_transposition_index([line_a, line_b]),
        out,
        generated_at="2026-05-15T00:00:00Z",
    )
    data = json.loads(out.read_text())
    assert data["schema_version"] == 1
    assert data["fen_hash_algo"] == "sha1-16"
    assert data["fen_normalization"] == "drop-counters"
    assert "index" in data


def test_known_transposition_correctness() -> None:
    """1.e4 c5 2.Nf3 e6 transposes with 1.e4 e6 2.Nf3 c5 (same FEN, drop counters)."""
    line_a = _line("french-style", ["e4", "c5", "Nf3", "e6"])
    line_b = _line("sicilian-style", ["e4", "e6", "Nf3", "c5"])
    index = build_transposition_index([line_a, line_b])
    import chess

    board = chess.Board()
    for san in ["e4", "c5", "Nf3", "e6"]:
        board.push_san(san)
    h = fen_hash(board.fen())
    assert h in index
    assert sorted(index[h]) == ["french-style", "sicilian-style"]
