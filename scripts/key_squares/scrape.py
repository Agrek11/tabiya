"""Scrape driver — pull opening prose from whitelisted sources.

Pipeline:
    1. Load sources.yml whitelist.
    2. For each opening: for each source, discover URLs, apply robots check
       + rate limit, fetch via the adapter.
    3. Filter non-permissive licenses (skip + log per R1.5).
    4. Apply prose normalization (lib/normalize.py).
    5. Write ``data/key_squares/scraped/<opening_slug>.json``.

Idempotent: re-runs overwrite. Crash-safe: per-opening writes are atomic.
Article 11: this is an OFFLINE BUILD STEP. Runtime never touches scraped/.

Usage::

    uv run python -m scripts.key_squares.scrape \\
        --openings ruy-lopez-closed,italian-game-main

If ``--openings`` is omitted, the driver reads
``scripts/curated/lines.yml`` and scrapes every distinct ``opening_id``
(synthesized 1:1 from ``variation_id`` per the curated-v2 builder).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections.abc import Iterable
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import yaml

from .adapters.base import PERMISSIVE_SPDX, ProseChunk, SourceAdapter
from .adapters.lichess_explorer import LichessExplorerAdapter
from .adapters.wikipedia import WikipediaAdapter
from .lib.normalize import cap_per_opening, is_substantive
from .lib.ratelimit import TokenBucketLimiter
from .lib.robots import robots_allows

logger = logging.getLogger("tabiya.key_squares.scrape")


REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SOURCES_YML = Path(__file__).resolve().parent / "sources.yml"
SCRAPED_DIR = REPO_ROOT / "data" / "key_squares" / "scraped"


@dataclass(frozen=True)
class SourceEntry:
    id: str
    license: str
    base_url: str
    adapter: str
    url_pattern: str
    rate_limit_rps: float
    selector: str | None


@dataclass(frozen=True)
class OpeningSeed:
    """Minimal opening identity for scraping."""

    opening_slug: str
    opening_name: str
    fen_after_main_line: str


# Registry of adapter constructors. Adding a source = new entry here +
# matching sources.yml entry.
ADAPTER_REGISTRY: dict[str, type[SourceAdapter]] = {
    "wikipedia": WikipediaAdapter,  # type: ignore[dict-item]
    "lichess_explorer": LichessExplorerAdapter,  # type: ignore[dict-item]
}


def load_sources(path: Path = SOURCES_YML) -> list[SourceEntry]:
    """Parse sources.yml into a typed list."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    out: list[SourceEntry] = []
    for entry in raw.get("sources", []):
        out.append(
            SourceEntry(
                id=entry["id"],
                license=entry["license"],
                base_url=entry["base_url"],
                adapter=entry["adapter"],
                url_pattern=entry.get("url_pattern", ""),
                rate_limit_rps=float(entry.get("rate_limit_rps", 1.0)),
                selector=entry.get("selector"),
            )
        )
    return out


def load_openings_from_curated(lines_yml: Path) -> list[OpeningSeed]:
    """Derive scrape targets from scripts/curated/lines.yml.

    For each opening_id (synthesized 1:1 with variation_id in curated v2),
    we scrape once. The canonical FEN is the end_fen of the first line under
    that opening (its main line).
    """
    import chess  # local import — keeps the module light when no scrape needed

    raw = yaml.safe_load(lines_yml.read_text(encoding="utf-8")) or {}
    seen: dict[str, OpeningSeed] = {}
    for entry in raw.get("lines", []):
        opening_slug = entry["variation_id"]
        if opening_slug in seen:
            continue
        # Replay PGN to get the canonical FEN
        pgn = entry.get("pgn", "")
        board = chess.Board()
        for token in pgn.split():
            if not token:
                continue
            if token[0].isdigit() and "." in token:
                stripped = token.split(".", 1)[1].strip(".")
                if not stripped:
                    continue
                token = stripped
            if token in {"1-0", "0-1", "1/2-1/2", "*"}:
                break
            try:
                board.push_san(token)
            except (ValueError, chess.IllegalMoveError):
                break
        seen[opening_slug] = OpeningSeed(
            opening_slug=opening_slug,
            opening_name=entry["name"],
            fen_after_main_line=board.fen(),
        )
    return list(seen.values())


def _build_adapter(entry: SourceEntry) -> SourceAdapter:
    cls = ADAPTER_REGISTRY.get(entry.adapter)
    if cls is None:
        raise ValueError(
            f"Unknown adapter {entry.adapter!r} in sources.yml; add it to ADAPTER_REGISTRY"
        )
    return cls()


def _candidate_urls_for(
    adapter: SourceAdapter, entry: SourceEntry, opening: OpeningSeed
) -> list[str]:
    """Compute candidate URLs for one opening on one source.

    Lichess Explorer is FEN-keyed (no name discovery), so we synthesize the
    URL from ``url_pattern`` + the opening's canonical FEN. All other adapters
    use ``adapter.discover()``.
    """
    if entry.adapter == "lichess_explorer":
        from urllib.parse import quote

        return [
            f"{entry.base_url}{entry.url_pattern.format(fen_after_main_line=quote(opening.fen_after_main_line))}"
        ]
    return adapter.discover(opening.opening_slug, opening.opening_name)


def scrape_one(
    opening: OpeningSeed,
    sources: list[SourceEntry],
    limiter: TokenBucketLimiter,
    *,
    adapters: dict[str, SourceAdapter] | None = None,
    robots_check: bool = True,
) -> dict[str, Any]:
    """Scrape one opening across all whitelisted sources.

    Returns the JSON-serializable scraped record per design §2a.1.
    """
    adapters = adapters or {}
    chunks: list[ProseChunk] = []
    for entry in sources:
        adapter = adapters.setdefault(entry.id, _build_adapter(entry))
        limiter.configure_host(urlparse(entry.base_url).netloc, entry.rate_limit_rps)

        for url in _candidate_urls_for(adapter, entry, opening):
            if robots_check and not robots_allows(url):
                logger.info("robots disallow: %s", url)
                continue
            limiter.wait(url)
            chunk = adapter.fetch(url)
            if chunk is None:
                continue
            if chunk.license not in PERMISSIVE_SPDX:
                logger.warning("non-permissive license %s for %s — skipping", chunk.license, url)
                continue
            if not is_substantive(chunk.text):
                continue
            chunks.append(chunk)

    # Per-opening cap (oldest-first wins on overflow)
    texts = cap_per_opening([c.text for c in chunks])
    capped_chunks = [
        {"source_url": c.source_url, "license": c.license, "text": t}
        for c, t in zip(chunks, texts, strict=False)
    ]

    return {
        "opening_slug": opening.opening_slug,
        "opening_name": opening.opening_name,
        "fen_after_main_line": opening.fen_after_main_line,
        "prose_chunks": capped_chunks,
    }


def write_scraped(record: dict[str, Any], out_dir: Path = SCRAPED_DIR) -> Path:
    """Write the scraped record JSON atomically. Returns the output path."""
    out_dir.mkdir(parents=True, exist_ok=True)
    path = out_dir / f"{record['opening_slug']}.json"
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(
        json.dumps(record, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    tmp.replace(path)
    return path


def main(
    openings: Iterable[OpeningSeed],
    *,
    force: bool = False,
    out_dir: Path = SCRAPED_DIR,
    sources_path: Path = SOURCES_YML,
    robots_check: bool = True,
) -> int:
    """Run the scrape pipeline. Returns 0 on success."""
    sources = load_sources(sources_path)
    limiter = TokenBucketLimiter()
    adapter_cache: dict[str, SourceAdapter] = {}
    for opening in openings:
        out_path = out_dir / f"{opening.opening_slug}.json"
        if out_path.exists() and not force:
            logger.info("skip (cached): %s", opening.opening_slug)
            continue
        logger.info("scraping: %s", opening.opening_slug)
        record = scrape_one(
            opening,
            sources,
            limiter,
            adapters=adapter_cache,
            robots_check=robots_check,
        )
        write_scraped(record, out_dir)
    return 0


def _cli_main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--openings",
        help="Comma-separated opening slugs to scrape (default: all curated)",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing scraped/<slug>.json files",
    )
    parser.add_argument(
        "--lines-yml",
        type=Path,
        default=REPO_ROOT / "scripts" / "curated" / "lines.yml",
    )
    parser.add_argument(
        "--no-robots",
        action="store_true",
        help="Disable robots.txt check (offline test only; never use in prod)",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    all_seeds = load_openings_from_curated(args.lines_yml)
    if args.openings:
        wanted = set(args.openings.split(","))
        seeds = [s for s in all_seeds if s.opening_slug in wanted]
    else:
        seeds = all_seeds
    return main(seeds, force=args.force, robots_check=not args.no_robots)


if __name__ == "__main__":
    raise SystemExit(_cli_main(sys.argv[1:]))
