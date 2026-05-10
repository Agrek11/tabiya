"""Tests for flat_tsv_builder — TSV-row → Opening + Line bulk ingest."""

from __future__ import annotations

from scripts.tabiya_build.flat_tsv_builder import (
    MAX_PLY,
    UNCATEGORIZED_FAMILY_ID,
    build_from_tsv_rows,
)
from scripts.tabiya_build.tsv import TsvRow


def _row(eco: str, name: str, pgn: str, san: tuple[str, ...]) -> TsvRow:
    return TsvRow(eco=eco, name=name, pgn=pgn, san_moves=san)


def test_emits_one_opening_and_one_line_per_row() -> None:
    rows = [
        _row("C20", "King's Pawn", "1. e4", ("e4",)),
        _row("B20", "Sicilian Defense", "1. e4 c5", ("e4", "c5")),
    ]
    openings, lines = build_from_tsv_rows(rows)
    assert len(openings) == 2
    assert len(lines) == 2


def test_assigns_uncategorized_family() -> None:
    rows = [_row("C20", "King's Pawn", "1. e4", ("e4",))]
    openings, _ = build_from_tsv_rows(rows)
    assert openings[0].family_id == UNCATEGORIZED_FAMILY_ID


def test_flags_gambit_by_name_substring() -> None:
    rows = [
        _row("C20", "King's Gambit", "1. e4 e5 2. f4", ("e4", "e5", "f4")),
        _row("C50", "Italian Game", "1. e4 e5 2. Nf3 Nc6 3. Bc4", ("e4", "e5", "Nf3", "Nc6", "Bc4")),
    ]
    openings, _ = build_from_tsv_rows(rows)
    by_name = {o.name: o for o in openings}
    assert by_name["King's Gambit"].is_gambit is True
    assert by_name["Italian Game"].is_gambit is False


def test_color_inference_defense_keyword() -> None:
    rows = [_row("B20", "Sicilian Defense", "1. e4 c5", ("e4", "c5"))]
    openings, _ = build_from_tsv_rows(rows)
    assert openings[0].color == "black"


def test_color_inference_default_white() -> None:
    rows = [_row("A00", "Polish Opening", "1. b4", ("b4",))]
    openings, _ = build_from_tsv_rows(rows)
    assert openings[0].color == "white"


def test_skips_rows_exceeding_max_ply() -> None:
    long_san = tuple(["e4", "e5"] * (MAX_PLY // 2 + 2))
    assert len(long_san) > MAX_PLY
    rows = [
        _row("C20", "Short", "1. e4", ("e4",)),
        _row("C20", "Too Long", " ".join(long_san), long_san),
    ]
    openings, lines = build_from_tsv_rows(rows)
    assert len(openings) == 1
    assert len(lines) == 1
    assert openings[0].name == "Short"


def test_skips_illegal_san() -> None:
    rows = [
        _row("C20", "Legal", "1. e4", ("e4",)),
        _row("C20", "Illegal", "1. Nz9", ("Nz9",)),
    ]
    openings, _ = build_from_tsv_rows(rows)
    assert len(openings) == 1
    assert openings[0].name == "Legal"


def test_id_minter_handles_dupe_names() -> None:
    rows = [
        _row("A00", "Same Name", "1. e4", ("e4",)),
        _row("A00", "Same Name", "1. d4", ("d4",)),
    ]
    openings, lines = build_from_tsv_rows(rows)
    assert len(openings) == 2
    assert openings[0].id != openings[1].id


def test_line_end_fen_populated() -> None:
    rows = [_row("C20", "Open", "1. e4 e5", ("e4", "e5"))]
    _, lines = build_from_tsv_rows(rows)
    assert lines[0].end_fen.startswith("rnbqkbnr/pppp")  # post-1...e5 position


def test_gambit_tag_applied_to_line() -> None:
    rows = [_row("C20", "King's Gambit", "1. e4 e5 2. f4", ("e4", "e5", "f4"))]
    _, lines = build_from_tsv_rows(rows)
    assert "gambit" in lines[0].tags


def test_empty_input_returns_empty() -> None:
    openings, lines = build_from_tsv_rows([])
    assert openings == []
    assert lines == []
