"""Tests for Pydantic schema."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from scripts.tabiya_build.schema import Catalog, KeySquare, Line, Opening


def make_line(**overrides: object) -> Line:
    base: dict[str, object] = {
        "id": "ruy-lopez-main",
        "opening_id": "ruy-lopez",
        "name": "Main Line",
        "moves": ["e4", "e5", "Nf3", "Nc6", "Bb5"],
        "depth": 5,
        "end_fen": "r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
        "popularity": 0.42,
    }
    base.update(overrides)
    return Line(**base)  # type: ignore[arg-type]


class TestLine:
    def test_minimal_valid(self) -> None:
        line = make_line()
        assert line.tags == []
        assert line.strategic_notes == []
        assert line.key_squares == []

    def test_with_overlay(self) -> None:
        ks = KeySquare(square="d5", note="central", side="both")
        line = make_line(strategic_notes=["aim for d5"], key_squares=[ks])
        assert line.key_squares[0].side == "both"

    def test_depth_must_be_in_range(self) -> None:
        with pytest.raises(ValidationError):
            make_line(depth=21)
        with pytest.raises(ValidationError):
            make_line(depth=0)

    def test_popularity_must_be_in_range(self) -> None:
        with pytest.raises(ValidationError):
            make_line(popularity=-0.1)
        with pytest.raises(ValidationError):
            make_line(popularity=1.1)


class TestOpening:
    def test_color_must_be_white_or_black(self) -> None:
        Opening(id="x", name="X", eco="A00", color="white", line_ids=[])
        Opening(id="x", name="X", eco="A00", color="black", line_ids=[])
        with pytest.raises(ValidationError):
            Opening(id="x", name="X", eco="A00", color="purple", line_ids=[])  # type: ignore[arg-type]


class TestCatalog:
    def test_roundtrip_json(self) -> None:
        cat = Catalog(
            version="2026-05-10",
            openings=[Opening(id="x", name="X", eco="A00", color="white", line_ids=[])],
            lines=[],
        )
        body = cat.model_dump_json()
        round_tripped = Catalog.model_validate_json(body)
        assert round_tripped == cat

    def test_version_is_required(self) -> None:
        with pytest.raises(ValidationError):
            Catalog(openings=[], lines=[])  # type: ignore[call-arg]
