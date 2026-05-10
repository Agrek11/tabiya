"""Tests for curated_v2_builder — YAML → Family/Variation/Opening/Line."""

from __future__ import annotations

from pathlib import Path

import pytest

from scripts.tabiya_build.curated_v2_builder import (
    MAX_PLY,
    _parse_pgn_to_san,
    build,
    load_families,
    load_lines,
    load_variations,
)


def _write(tmp_path: Path, name: str, body: str) -> Path:
    p = tmp_path / name
    p.write_text(body, encoding="utf-8")
    return p


def test_parse_pgn_skips_move_numbers() -> None:
    assert _parse_pgn_to_san("1. e4 e5 2. Nf3") == ["e4", "e5", "Nf3"]


def test_parse_pgn_drops_result_terminator() -> None:
    assert _parse_pgn_to_san("1. e4 e5 1-0") == ["e4", "e5"]


def test_parse_pgn_rejects_illegal_move() -> None:
    with pytest.raises(ValueError, match="illegal SAN"):
        _parse_pgn_to_san("1. Nz9")


def test_load_families(tmp_path: Path) -> None:
    p = _write(
        tmp_path,
        "f.yml",
        """
families:
  - id: spanish
    name: Spanish (Ruy Lopez)
    category: open
    tier: 1
    eco_range: C60-C99
""",
    )
    result = load_families(p)
    assert len(result) == 1
    assert result[0].id == "spanish"
    assert result[0].tier == 1


def test_load_variations(tmp_path: Path) -> None:
    p = _write(
        tmp_path,
        "v.yml",
        """
variations:
  - id: spanish-closed
    family_id: spanish
    name: Closed Spanish
    eco: C84
    color: white
    trunk_pgn: "1. e4 e5 2. Nf3"
""",
    )
    result = load_variations(p)
    assert len(result) == 1
    assert result[0].trunk_moves == ["e4", "e5", "Nf3"]


def test_load_lines_rejects_long_pgn(tmp_path: Path) -> None:
    # Genuinely legal 22-ply sequence (knight + king shuffles). Long enough
    # to trigger the Article 8 cap.
    long_pgn = (
        "1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Ng1 Ng8 "
        "5. Nf3 Nf6 6. Ng1 Ng8 7. Nf3 Nf6 8. Ng1 Ng8 "
        "9. Nf3 Nf6 10. Ng1 Ng8 11. Nf3 Nf6"
    )
    assert len(long_pgn.split()) > MAX_PLY  # confirm the test premise
    p = _write(
        tmp_path,
        "l.yml",
        f"""
lines:
  - id: too-long
    variation_id: x
    name: Long
    pgn: "{long_pgn}"
""",
    )
    with pytest.raises(ValueError, match="exceeds Article 8 cap"):
        load_lines(p)


def test_build_full_pipeline(tmp_path: Path) -> None:
    families_yml = _write(
        tmp_path,
        "families.yml",
        """
families:
  - id: spanish
    name: Spanish
    category: open
    tier: 1
    eco_range: C60-C99
""",
    )
    variations_yml = _write(
        tmp_path,
        "variations.yml",
        """
variations:
  - id: spanish-closed
    family_id: spanish
    name: Closed Spanish
    eco: C84
    color: white
    trunk_pgn: "1. e4 e5 2. Nf3"
""",
    )
    lines_yml = _write(
        tmp_path,
        "lines.yml",
        """
lines:
  - id: spanish-closed-main
    variation_id: spanish-closed
    name: Main Line
    pgn: "1. e4 e5 2. Nf3 Nc6 3. Bb5"
""",
    )
    families, variations, openings, lines, presets = build(families_yml, variations_yml, lines_yml)
    assert presets == []
    assert len(families) == 1
    assert len(variations) == 1
    assert len(openings) == 1
    assert len(lines) == 1
    assert variations[0].line_ids == ["spanish-closed-main"]
    assert families[0].opening_ids == [openings[0].id]
    assert lines[0].opening_id == openings[0].id


def test_build_rejects_dangling_family_ref(tmp_path: Path) -> None:
    families_yml = _write(
        tmp_path,
        "families.yml",
        "families:\n  - id: x\n    name: X\n    category: open\n    tier: 1\n    eco_range: ''\n",
    )
    variations_yml = _write(
        tmp_path,
        "variations.yml",
        """
variations:
  - id: orphan
    family_id: nope
    name: Orphan
    eco: A00
    color: white
    trunk_pgn: "1. e4"
""",
    )
    lines_yml = _write(tmp_path, "lines.yml", "lines: []\n")
    with pytest.raises(ValueError, match="unknown family_id"):
        build(families_yml, variations_yml, lines_yml)


def test_build_rejects_dangling_variation_ref(tmp_path: Path) -> None:
    families_yml = _write(
        tmp_path,
        "families.yml",
        "families:\n  - id: x\n    name: X\n    category: open\n    tier: 1\n    eco_range: ''\n",
    )
    variations_yml = _write(tmp_path, "variations.yml", "variations: []\n")
    lines_yml = _write(
        tmp_path,
        "lines.yml",
        """
lines:
  - id: orphan
    variation_id: nope
    name: Orphan
    pgn: "1. e4"
""",
    )
    with pytest.raises(ValueError, match="unknown variation_id"):
        build(families_yml, variations_yml, lines_yml)
