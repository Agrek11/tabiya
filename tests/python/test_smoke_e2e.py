"""End-to-end smoke test for the catalog build pipeline.

Pre-seeds the cache directories with:
  - 5 minimal TSV files (a.tsv .. e.tsv) so download_all is a cache-hit no-op
  - A single Explorer response per opening's seed-FEN that returns ZERO
    continuations, causing the extender to stop at "no_continuations" with
    just the seed moves.

Then invokes scripts.build_catalog.main([...]) end-to-end and asserts:
  - Output JSON exists and parses through Pydantic
  - The selected openings appear in the catalog
  - Each opening has ≥ 1 line of length == seed length
  - No live network calls (FakeExplorer fixtures only via cache)
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from scripts.build_catalog import main as build_main
from scripts.tabiya_build.extender import play_moves, seed_to_san
from scripts.tabiya_build.schema import Catalog
from scripts.tabiya_build.whitelist import get_opening

SAMPLE_TSV = "eco\tname\tpgn\nC60\tSpanish Game\t1. e4 e5 2. Nf3 Nc6 3. Bb5\n"


def _fen_hash(fen: str) -> str:
    return hashlib.sha1(fen.encode("utf-8")).hexdigest()


def _empty_response_json() -> str:
    return json.dumps(
        {"white": 0, "draws": 0, "black": 0, "moves": [], "opening": None},
        indent=2,
    )


def _seed_explorer_cache(cache_dir: Path, opening_ids: list[str]) -> None:
    """Pre-seed the explorer cache with empty-moves responses for each seed FEN."""
    explorer_cache = cache_dir / "explorer"
    explorer_cache.mkdir(parents=True, exist_ok=True)
    for oid in opening_ids:
        spec = get_opening(oid)
        assert spec is not None, f"unknown opening {oid}"
        seed = seed_to_san(spec.seed_pgn)
        end_fen = play_moves(seed).fen()
        path = explorer_cache / f"{_fen_hash(end_fen)}.json"
        path.write_text(_empty_response_json(), encoding="utf-8")


def _seed_tsv_cache(cache_dir: Path) -> None:
    tsv_cache = cache_dir / "openings-tsv"
    tsv_cache.mkdir(parents=True, exist_ok=True)
    for letter in ("a", "b", "c", "d", "e"):
        (tsv_cache / f"{letter}.tsv").write_text(SAMPLE_TSV, encoding="utf-8")


def test_smoke_two_openings(tmp_path: Path) -> None:
    cache = tmp_path / "cache"
    out = tmp_path / "catalog.json"
    notes = tmp_path / "absent-notes.yml"  # intentionally missing

    selected = ["ruy-lopez", "italian-game"]
    _seed_tsv_cache(cache)
    _seed_explorer_cache(cache, selected)

    rc = build_main(
        [
            "--source",
            "curated",
            "--openings",
            ",".join(selected),
            "--cache-dir",
            str(cache),
            "--out",
            str(out),
            "--notes",
            str(notes),
            "--log-level",
            "WARNING",
        ]
    )
    assert rc == 0
    assert out.exists()

    body = out.read_text(encoding="utf-8")
    catalog = Catalog.model_validate_json(body)

    assert len(catalog.openings) == 2
    opening_ids = {o.id for o in catalog.openings}
    assert opening_ids == set(selected)

    # Each opening should have at least one line, all of which are seed-only
    # (because we pre-seeded the explorer with empty-moves responses).
    assert len(catalog.lines) >= 2
    for line in catalog.lines:
        spec = get_opening(line.opening_id)
        assert spec is not None
        assert line.depth == len(seed_to_san(spec.seed_pgn))

    # Output should be pretty-printed (contains indentation)
    assert "  " in body
    # Trailing newline (Req 7.3)
    assert body.endswith("\n")
    # Under the size cap (R7.5)
    assert out.stat().st_size < 500 * 1024


def test_smoke_unknown_opening_id_exits_non_zero(tmp_path: Path) -> None:
    cache = tmp_path / "cache"
    _seed_tsv_cache(cache)

    rc = build_main(
        [
            "--source",
            "curated",
            "--openings",
            "nonexistent-opening-id",
            "--cache-dir",
            str(cache),
            "--out",
            str(tmp_path / "out.json"),
            "--notes",
            str(tmp_path / "absent.yml"),
            "--log-level",
            "ERROR",
        ]
    )
    assert rc == 1
