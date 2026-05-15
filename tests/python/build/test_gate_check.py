"""Phase 2a → 2b unlock gate-check tests (R9.1)."""

from __future__ import annotations

from pathlib import Path

import yaml

from scripts.key_squares.gate_check import count_approved
from scripts.key_squares.gate_check import main as gate_main


def _curated(tmp_path: Path, entries: int, squares_per_entry: int = 1) -> Path:
    path = tmp_path / "key_squares.yml"
    payload = {}
    for i in range(entries):
        payload[f"opening-{i}"] = {
            "fen_canonical": "fen",
            "squares": [
                {
                    "square": "d5",
                    "role": "control",
                    "for_color": "white",
                    "rationale": "x",
                    "source_url": "https://en.wikipedia.org/wiki/X",
                }
                for _ in range(squares_per_entry)
            ],
        }
    path.write_text(yaml.safe_dump(payload), encoding="utf-8")
    return path


def test_count_approved_zero_when_missing(tmp_path: Path) -> None:
    assert count_approved(tmp_path / "nope.yml") == 0


def test_count_approved_skips_empty_squares(tmp_path: Path) -> None:
    path = tmp_path / "key_squares.yml"
    path.write_text(
        yaml.safe_dump(
            {
                "alpha": {"fen_canonical": "fen", "squares": []},
                "bravo": {
                    "fen_canonical": "fen",
                    "squares": [
                        {
                            "square": "d5",
                            "role": "control",
                            "for_color": "white",
                            "rationale": "x",
                            "source_url": "https://en.wikipedia.org/wiki/X",
                        }
                    ],
                },
            }
        ),
        encoding="utf-8",
    )
    assert count_approved(path) == 1


def test_gate_fails_below_threshold(tmp_path: Path) -> None:
    path = _curated(tmp_path, entries=5)
    rc = gate_main(["--curated", str(path), "--threshold", "30"])
    assert rc == 1


def test_gate_passes_at_threshold(tmp_path: Path) -> None:
    path = _curated(tmp_path, entries=30)
    rc = gate_main(["--curated", str(path), "--threshold", "30"])
    assert rc == 0
