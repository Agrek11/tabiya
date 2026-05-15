"""Tests for scripts.tabiya_build.validate_explain — Phase 1b R5 AC #2."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.tabiya_build.schema import (
    Catalog,
    Line,
    Opening,
)
from scripts.tabiya_build.validate_explain import (
    ExplainValidationError,
    copy_explain_to_public,
    validate_all_explain_sidecars,
    validate_sidecar_file,
)


def make_catalog(line_id: str = "test-line", moves: list[str] | None = None) -> Catalog:
    moves = moves or ["e4", "e5", "Nf3"]
    line = Line(
        id=line_id,
        opening_id="op",
        name="Test",
        moves=moves,
        depth=len(moves),
        end_fen="rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2",
        popularity=0.1,
    )
    opening = Opening(id="op", family_id="fam", name="Op", eco="C00", color="white", line_ids=[line_id])
    return Catalog(version="2026-05-15", schema_version=2, openings=[opening], lines=[line])


def write_sidecar(tmp_path: Path, line_id: str, payload: dict) -> Path:
    file = tmp_path / f"{line_id}.json"
    file.write_text(json.dumps(payload), encoding="utf-8")
    return file


VALID_PAYLOAD = {
    "line_id": "test-line",
    "schema_version": 2,
    "blocks": [
        {"rationale": "open"},
        {"rationale": "mirror"},
        {"rationale": "attack"},
    ],
}


def test_valid_sidecar_passes(tmp_path: Path) -> None:
    catalog = make_catalog()
    file = write_sidecar(tmp_path, "test-line", VALID_PAYLOAD)
    sidecar = validate_sidecar_file(file, catalog)
    assert sidecar.line_id == "test-line"
    assert len(sidecar.blocks) == 3


def test_length_mismatch_fails(tmp_path: Path) -> None:
    catalog = make_catalog(moves=["e4", "e5"])  # length 2
    file = write_sidecar(tmp_path, "test-line", VALID_PAYLOAD)  # blocks=3
    with pytest.raises(ExplainValidationError, match="blocks=3 but line.moves=2"):
        validate_sidecar_file(file, catalog)


def test_bad_square_in_arrow_fails(tmp_path: Path) -> None:
    catalog = make_catalog()
    bad = dict(VALID_PAYLOAD)
    bad["blocks"] = [
        {"rationale": "x", "arrows": [{"from": "e9", "to": "e4"}]},
        {"rationale": "y"},
        {"rationale": "z"},
    ]
    file = write_sidecar(tmp_path, "test-line", bad)
    with pytest.raises(ExplainValidationError):
        validate_sidecar_file(file, catalog)


def test_missing_rationale_fails(tmp_path: Path) -> None:
    catalog = make_catalog()
    bad = dict(VALID_PAYLOAD)
    bad["blocks"] = [{}, {"rationale": "y"}, {"rationale": "z"}]
    file = write_sidecar(tmp_path, "test-line", bad)
    with pytest.raises(ExplainValidationError):
        validate_sidecar_file(file, catalog)


def test_pause_ms_out_of_bounds_fails(tmp_path: Path) -> None:
    catalog = make_catalog()
    bad = dict(VALID_PAYLOAD)
    bad["blocks"] = [
        {"rationale": "x", "pauseMs": 100},  # < 500
        {"rationale": "y"},
        {"rationale": "z"},
    ]
    file = write_sidecar(tmp_path, "test-line", bad)
    with pytest.raises(ExplainValidationError):
        validate_sidecar_file(file, catalog)


def test_schema_version_mismatch_fails(tmp_path: Path) -> None:
    catalog = make_catalog()  # schema_version=2
    bad = dict(VALID_PAYLOAD)
    bad["schema_version"] = 1
    file = write_sidecar(tmp_path, "test-line", bad)
    with pytest.raises(ExplainValidationError, match="schema_version mismatch"):
        validate_sidecar_file(file, catalog)


def test_unknown_line_id_fails(tmp_path: Path) -> None:
    catalog = make_catalog()
    bad = dict(VALID_PAYLOAD)
    bad["line_id"] = "ghost-line"
    file = write_sidecar(tmp_path, "ghost-line", bad)
    with pytest.raises(ExplainValidationError, match="not found in catalog"):
        validate_sidecar_file(file, catalog)


def test_validate_all_skips_pending_subdir(tmp_path: Path) -> None:
    catalog = make_catalog()
    write_sidecar(tmp_path, "test-line", VALID_PAYLOAD)
    # Stale draft in pending/ should NOT be validated.
    pending = tmp_path / "pending"
    pending.mkdir()
    (pending / "junk.json").write_text("{not json}", encoding="utf-8")
    sidecars = validate_all_explain_sidecars(tmp_path, catalog)
    assert len(sidecars) == 1


def test_copy_explain_to_public(tmp_path: Path) -> None:
    src = tmp_path / "data"
    src.mkdir()
    (src / "pending").mkdir()
    write_sidecar(src, "test-line", VALID_PAYLOAD)
    # Pending file should be skipped.
    (src / "pending" / "draft.json").write_text("{}", encoding="utf-8")
    dst = tmp_path / "public"
    n = copy_explain_to_public(src, dst)
    assert n == 1
    assert (dst / "test-line.json").exists()
    assert not (dst / "draft.json").exists()
