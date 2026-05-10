"""Tests for writer.write_catalog + print_summary."""

from __future__ import annotations

import json
from pathlib import Path

from scripts.tabiya_build.schema import Catalog, Family, Line, Opening
from scripts.tabiya_build.writer import build_version, print_summary, write_catalog


def _sample_catalog() -> Catalog:
    return Catalog(
        version="2026-05-10",
        families=[
            Family(
                id="open-games",
                name="Open Games",
                category="open",
                eco_range="C20-C99",
                opening_ids=["ruy-lopez"],
            )
        ],
        openings=[
            Opening(
                id="ruy-lopez",
                family_id="open-games",
                name="Ruy Lopez",
                eco="C60-C99",
                color="black",
                line_ids=["ruy-lopez-main"],
            )
        ],
        lines=[
            Line(
                id="ruy-lopez-main",
                opening_id="ruy-lopez",
                name="Main",
                moves=["e4", "e5", "Nf3", "Nc6", "Bb5"],
                depth=5,
                end_fen="r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
                popularity=0.42,
            )
        ],
    )


def test_write_catalog_creates_pretty_json(tmp_path: Path) -> None:
    cat = _sample_catalog()
    out = tmp_path / "catalog.json"
    size = write_catalog(cat, out)
    assert size > 0
    body = out.read_text()
    assert body.endswith("\n")
    # 2-space indent → at least one line begins with two spaces
    assert any(line.startswith("  ") for line in body.splitlines())
    # parses back through Pydantic
    Catalog.model_validate_json(body)


def test_write_catalog_creates_parent_dir(tmp_path: Path) -> None:
    cat = _sample_catalog()
    out = tmp_path / "deep" / "nested" / "catalog.json"
    write_catalog(cat, out)
    assert out.exists()


def test_round_trips_through_json(tmp_path: Path) -> None:
    cat = _sample_catalog()
    out = tmp_path / "catalog.json"
    write_catalog(cat, out)
    parsed = json.loads(out.read_text())
    assert parsed["version"] == "2026-05-10"
    assert parsed["openings"][0]["id"] == "ruy-lopez"


def test_build_version_format() -> None:
    v = build_version()
    # YYYY-MM-DD
    assert len(v) == 10
    assert v[4] == "-" and v[7] == "-"


def test_print_summary_runs(capsys: object) -> None:
    cat = _sample_catalog()
    print_summary(cat, file_size_bytes=1234)  # should not raise
