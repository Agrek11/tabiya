"""Smoke test: the real curated/key_squares.yml passes license_audit.

Tripwire for Article 1. If a reviewer ever lands a source_url whose host is
not in scripts/key_squares/sources.yml, this test fails the build before merge.
"""

from __future__ import annotations

from pathlib import Path

from scripts.tabiya_build.key_squares import license_audit, load_curated_key_squares

REPO_ROOT = Path(__file__).resolve().parents[3]
CURATED = REPO_ROOT / "scripts" / "curated" / "key_squares.yml"
SOURCES = REPO_ROOT / "scripts" / "key_squares" / "sources.yml"


def test_curated_key_squares_pass_license_audit() -> None:
    curated = load_curated_key_squares(CURATED)
    if not curated:
        # Empty curated = trivially passes (no source_urls to audit). The
        # ≥30-opening gate is checked separately via gate_check.py.
        return
    license_audit(curated, SOURCES)
