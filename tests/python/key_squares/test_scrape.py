"""Scrape driver integration tests (adapters mocked)."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import patch

from scripts.key_squares.adapters.base import ProseChunk
from scripts.key_squares.lib.ratelimit import TokenBucketLimiter
from scripts.key_squares.scrape import (
    OpeningSeed,
    SourceEntry,
    main,
    scrape_one,
    write_scraped,
)


def _seed() -> OpeningSeed:
    return OpeningSeed(
        opening_slug="italian-game-main",
        opening_name="Italian Game",
        fen_after_main_line="r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
    )


def _wiki_source() -> SourceEntry:
    return SourceEntry(
        id="wikipedia-en",
        license="CC-BY-SA-4.0",
        base_url="https://en.wikipedia.org",
        adapter="wikipedia",
        url_pattern="/wiki/{opening_name_url}",
        rate_limit_rps=1.0,
        selector=None,
    )


class FakeAdapter:
    name = "wikipedia"
    license = "CC-BY-SA-4.0"
    base_url = "https://en.wikipedia.org"

    def __init__(self, *, chunk: ProseChunk | None) -> None:
        self._chunk = chunk

    def discover(self, slug, name):
        return ["https://en.wikipedia.org/wiki/Italian_Game"]

    def fetch(self, url):
        return self._chunk


def test_scrape_one_writes_record_with_permissive_chunk(tmp_path: Path) -> None:
    chunk = ProseChunk(
        source_url="https://en.wikipedia.org/wiki/Italian_Game",
        license="CC-BY-SA-4.0",
        text="Italian Game prose with enough length to be substantive content.",
    )
    adapter = FakeAdapter(chunk=chunk)
    limiter = TokenBucketLimiter(default_rps=100.0, sleeper=lambda _: None)
    with patch("scripts.key_squares.scrape.robots_allows", return_value=True):
        record = scrape_one(
            _seed(),
            [_wiki_source()],
            limiter,
            adapters={"wikipedia-en": adapter},
        )
    assert record["opening_slug"] == "italian-game-main"
    assert len(record["prose_chunks"]) == 1
    assert record["prose_chunks"][0]["license"] == "CC-BY-SA-4.0"


def test_scrape_one_skips_non_permissive_license() -> None:
    chunk = ProseChunk(
        source_url="https://somewhere.invalid/x",
        license="Proprietary-EULA",
        text="Some text that's long enough to pass the substantive check.",
    )
    adapter = FakeAdapter(chunk=chunk)
    limiter = TokenBucketLimiter(default_rps=100.0, sleeper=lambda _: None)
    with patch("scripts.key_squares.scrape.robots_allows", return_value=True):
        record = scrape_one(
            _seed(),
            [_wiki_source()],
            limiter,
            adapters={"wikipedia-en": adapter},
        )
    assert record["prose_chunks"] == []


def test_scrape_one_robots_disallowed_skips_silently() -> None:
    chunk = ProseChunk(
        source_url="https://en.wikipedia.org/wiki/Italian_Game",
        license="CC-BY-SA-4.0",
        text="text long enough to be substantive prose for the chunk filter.",
    )
    adapter = FakeAdapter(chunk=chunk)
    limiter = TokenBucketLimiter(default_rps=100.0, sleeper=lambda _: None)
    with patch("scripts.key_squares.scrape.robots_allows", return_value=False):
        record = scrape_one(
            _seed(),
            [_wiki_source()],
            limiter,
            adapters={"wikipedia-en": adapter},
        )
    assert record["prose_chunks"] == []


def test_scrape_one_drops_chunks_below_substantive_threshold() -> None:
    chunk = ProseChunk(
        source_url="https://en.wikipedia.org/wiki/X",
        license="CC-BY-SA-4.0",
        text="too short",  # < MIN_CHUNK_LEN
    )
    adapter = FakeAdapter(chunk=chunk)
    limiter = TokenBucketLimiter(default_rps=100.0, sleeper=lambda _: None)
    with patch("scripts.key_squares.scrape.robots_allows", return_value=True):
        record = scrape_one(
            _seed(),
            [_wiki_source()],
            limiter,
            adapters={"wikipedia-en": adapter},
        )
    assert record["prose_chunks"] == []


def test_write_scraped_emits_deterministic_json(tmp_path: Path) -> None:
    record = {
        "opening_slug": "italian-game-main",
        "opening_name": "Italian Game",
        "fen_after_main_line": "fen-value",
        "prose_chunks": [],
    }
    path = write_scraped(record, out_dir=tmp_path)
    assert path.exists()
    data = json.loads(path.read_text(encoding="utf-8"))
    assert data == record
    # sort_keys=True → top-level keys are alphabetical
    raw = path.read_text(encoding="utf-8")
    assert raw.index('"fen_after_main_line"') < raw.index('"opening_name"')


def test_main_idempotent_skips_existing_files(tmp_path: Path) -> None:
    # Drop a pre-existing scraped file; main() should not overwrite it.
    seed = _seed()
    out_dir = tmp_path / "scraped"
    out_dir.mkdir()
    pre_existing = out_dir / "italian-game-main.json"
    pre_existing.write_text('{"pre":"existing"}', encoding="utf-8")

    sources_yml = tmp_path / "sources.yml"
    sources_yml.write_text(
        "sources:\n"
        "  - id: wikipedia-en\n"
        "    license: CC-BY-SA-4.0\n"
        "    base_url: https://en.wikipedia.org\n"
        "    adapter: wikipedia\n"
        "    url_pattern: /wiki/{opening_name_url}\n"
        "    rate_limit_rps: 1\n",
        encoding="utf-8",
    )
    # Should NOT touch the file (force=False default)
    main([seed], out_dir=out_dir, sources_path=sources_yml, robots_check=False)
    assert pre_existing.read_text(encoding="utf-8") == '{"pre":"existing"}'
