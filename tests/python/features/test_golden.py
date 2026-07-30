"""Golden-fixture runner — Phase 4b task 2.2.

Every evals/features/golden/*.json file declares a feature key path (dotted,
into the PositionFeatures dict) and positions with expected output. The
fixture is the spec of record (requirements-4b R5): a failing fixture means
the CODE is wrong unless the author amends the fixture deliberately.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pytest

import chess
from scripts.tabiya_build.features import extract_features

GOLDEN_DIR = Path(__file__).resolve().parents[3] / "evals" / "features" / "golden"

FIXTURES = sorted(GOLDEN_DIR.glob("*.json"))


def _dig(d: dict[str, Any], dotted: str) -> Any:
    cur: Any = d
    for part in dotted.split("."):
        cur = cur[part]
    return cur


def _cases() -> list[pytest.param]:
    params = []
    for path in FIXTURES:
        doc = json.loads(path.read_text())
        for pos in doc["positions"]:
            params.append(
                pytest.param(
                    doc["feature"],
                    pos["fen"],
                    pos["expected"],
                    id=f"{path.stem}::{pos.get('name', pos['fen'])}",
                )
            )
    return params


def test_fixture_dir_present() -> None:
    assert FIXTURES, f"no golden fixtures found under {GOLDEN_DIR}"


@pytest.mark.parametrize(("feature", "fen", "expected"), _cases())
def test_golden(feature: str, fen: str, expected: Any) -> None:
    board = chess.Board(fen)
    actual = _dig(extract_features(board), feature)
    assert actual == expected
