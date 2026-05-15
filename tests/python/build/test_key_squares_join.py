"""Catalog build — key_squares load, license audit, join tests."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from scripts.tabiya_build.key_squares import (
    BuildError,
    OpeningKeySquares,
    join_to_openings,
    license_audit,
    load_curated_key_squares,
)
from scripts.tabiya_build.schema import Opening


def _opening(slug: str) -> Opening:
    return Opening(
        id=slug,
        family_id="open-games",
        name="Test Opening",
        eco="C50",
        color="white",
        line_ids=[],
        is_gambit=False,
    )


def _sources_yml(tmp_path: Path) -> Path:
    path = tmp_path / "sources.yml"
    path.write_text(
        yaml.safe_dump(
            {
                "sources": [
                    {
                        "id": "wikipedia-en",
                        "license": "CC-BY-SA-4.0",
                        "base_url": "https://en.wikipedia.org",
                        "adapter": "wikipedia",
                        "url_pattern": "/wiki/{name}",
                        "rate_limit_rps": 1,
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    return path


def _curated_yml(tmp_path: Path, payload: dict) -> Path:
    path = tmp_path / "key_squares.yml"
    path.write_text(yaml.safe_dump(payload), encoding="utf-8")
    return path


def test_load_returns_empty_when_file_missing(tmp_path: Path) -> None:
    assert load_curated_key_squares(tmp_path / "nope.yml") == {}


def test_load_parses_valid_entries(tmp_path: Path) -> None:
    path = _curated_yml(
        tmp_path,
        {
            "italian-game-main": {
                "fen_canonical": "fen",
                "squares": [
                    {
                        "square": "f7",
                        "role": "weak",
                        "for_color": "black",
                        "rationale": "weak square",
                        "source_url": "https://en.wikipedia.org/wiki/Italian_Game",
                    }
                ],
            }
        },
    )
    out = load_curated_key_squares(path)
    assert "italian-game-main" in out
    assert out["italian-game-main"].squares[0].square == "f7"


def test_load_raises_on_malformed_entry(tmp_path: Path) -> None:
    path = _curated_yml(
        tmp_path,
        {
            "broken": {
                "fen_canonical": "fen",
                "squares": [
                    {
                        "square": "z9",  # invalid square
                        "role": "weak",
                        "for_color": "black",
                        "rationale": "x",
                        "source_url": "https://x.invalid/",
                    }
                ],
            }
        },
    )
    with pytest.raises(BuildError):
        load_curated_key_squares(path)


def test_license_audit_passes_for_permissive_host(tmp_path: Path) -> None:
    curated = {
        "italian": OpeningKeySquares.model_validate(
            {
                "fen_canonical": "fen",
                "squares": [
                    {
                        "square": "d5",
                        "role": "control",
                        "for_color": "white",
                        "rationale": "x",
                        "source_url": "https://en.wikipedia.org/wiki/Italian_Game",
                    }
                ],
            }
        )
    }
    license_audit(curated, _sources_yml(tmp_path))  # no raise


def test_license_audit_fails_for_unaudited_host(tmp_path: Path) -> None:
    curated = {
        "x": OpeningKeySquares.model_validate(
            {
                "fen_canonical": "fen",
                "squares": [
                    {
                        "square": "d5",
                        "role": "control",
                        "for_color": "white",
                        "rationale": "x",
                        "source_url": "https://someblog.example/chess",
                    }
                ],
            }
        )
    }
    with pytest.raises(BuildError, match="unaudited host"):
        license_audit(curated, _sources_yml(tmp_path))


def test_license_audit_fails_on_missing_sources_yml(tmp_path: Path) -> None:
    with pytest.raises(BuildError, match="sources.yml missing"):
        license_audit({}, tmp_path / "missing.yml")


def test_join_attaches_records_to_known_openings() -> None:
    openings = [_opening("italian-game-main")]
    curated = {
        "italian-game-main": OpeningKeySquares.model_validate(
            {
                "fen_canonical": "fen",
                "squares": [
                    {
                        "square": "f7",
                        "role": "weak",
                        "for_color": "black",
                        "rationale": "weak",
                        "source_url": "https://en.wikipedia.org/wiki/Italian_Game",
                    }
                ],
            }
        )
    }
    out = join_to_openings(openings, curated)
    assert "italian-game-main" in out
    assert out["italian-game-main"][0]["square"] == "f7"


def test_join_fails_on_unknown_slug() -> None:
    openings = [_opening("italian-game-main")]
    curated = {
        "ghost-opening": OpeningKeySquares.model_validate(
            {"fen_canonical": "fen", "squares": []}
        )
    }
    with pytest.raises(BuildError, match="unknown opening_slug"):
        join_to_openings(openings, curated)


def test_join_leaves_openings_without_entry_untouched() -> None:
    openings = [_opening("a"), _opening("b")]
    curated = {
        "a": OpeningKeySquares.model_validate({"fen_canonical": "fen", "squares": []})
    }
    out = join_to_openings(openings, curated)
    assert "b" not in out
