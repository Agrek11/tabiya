"""Tests for notes overlay loader + merger."""

from __future__ import annotations

from pathlib import Path

from scripts.tabiya_build.notes import LineOverlay, load_notes, merge_into_lines
from scripts.tabiya_build.schema import KeySquare, Line


def _make_line(line_id: str = "ruy-lopez-main") -> Line:
    return Line(
        id=line_id,
        opening_id="ruy-lopez",
        name="Main",
        moves=["e4", "e5"],
        depth=2,
        end_fen="rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
        popularity=0.5,
    )


class TestLoadNotes:
    def test_missing_file_returns_empty(self, tmp_path: Path) -> None:
        assert load_notes(tmp_path / "absent.yml") == {}

    def test_valid_yaml(self, tmp_path: Path) -> None:
        path = tmp_path / "notes.yml"
        path.write_text(
            "ruy-lopez-main:\n"
            "  strategic_notes:\n"
            "    - 'aim for d5'\n"
            "  key_squares:\n"
            "    - { square: d5, note: 'central', side: both }\n",
            encoding="utf-8",
        )
        out = load_notes(path)
        assert "ruy-lopez-main" in out
        ov = out["ruy-lopez-main"]
        assert ov.strategic_notes == ["aim for d5"]
        assert len(ov.key_squares) == 1
        assert ov.key_squares[0].square == "d5"

    def test_skips_non_mapping_body(self, tmp_path: Path) -> None:
        path = tmp_path / "notes.yml"
        path.write_text("ruy-lopez-main: just-a-string\n", encoding="utf-8")
        out = load_notes(path)
        assert out == {}

    def test_empty_file_returns_empty(self, tmp_path: Path) -> None:
        path = tmp_path / "notes.yml"
        path.write_text("", encoding="utf-8")
        assert load_notes(path) == {}


class TestMergeIntoLines:
    def test_overlay_applied(self) -> None:
        line = _make_line()
        ov = {
            "ruy-lopez-main": LineOverlay(
                strategic_notes=["test note"],
                key_squares=[KeySquare(square="d5", note="x", side="both")],
            )
        }
        merged = merge_into_lines([line], ov)
        assert merged[0].strategic_notes == ["test note"]
        assert merged[0].key_squares[0].square == "d5"

    def test_overlay_for_unknown_line_warns_but_succeeds(self) -> None:
        line = _make_line()
        ov = {
            "does-not-exist": LineOverlay(strategic_notes=["x"]),
        }
        merged = merge_into_lines([line], ov)
        assert merged[0].strategic_notes == []  # original line untouched

    def test_no_overlay_returns_lines_unchanged(self) -> None:
        line = _make_line()
        merged = merge_into_lines([line], {})
        assert merged[0].strategic_notes == []
