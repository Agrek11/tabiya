"""Catalog builder CLI entrypoint.

Usage:
    uv run python scripts/build_catalog.py [options]

Options:
    --refresh                ignore caches, re-fetch TSVs and Explorer responses
    --openings <id1,id2,..>  limit build to the given opening IDs
    --out <path>             override output path (default: public/catalog.json)
    --max-depth <n>          override the global depth cap for testing
    --notes <path>           override notes overlay path (default: scripts/curated/notes.yml)
    --cache-dir <path>       override cache directory (default: scripts/.cache)

Constitution Articles 1, 2, 6, 7, 8, 9, 11, 14 — see specs/constitution.md
"""

from __future__ import annotations

# Inject the OS trust store BEFORE any TLS-using import (httpx, etc.).
# This makes Python's ssl module use macOS Keychain / Windows Cert Store /
# Linux system trust roots instead of the bundled certifi list — necessary
# behind corporate MITM proxies (e.g. Zscaler).
import truststore

truststore.inject_into_ssl()

import argparse  # noqa: E402
import logging  # noqa: E402
import sys  # noqa: E402
from pathlib import Path  # noqa: E402

from .tabiya_build.explorer import ExplorerClient
from .tabiya_build.extender import extend_with_branch, seed_to_san
from .tabiya_build.notes import load_notes, merge_into_lines
from .tabiya_build.schema import Catalog, Line, Opening
from .tabiya_build.slug import IdMinter, slugify
from .tabiya_build.tsv import TsvRow, download_all, parse_all
from .tabiya_build.whitelist import OpeningSpec, filter_openings
from .tabiya_build.writer import build_version, print_summary, write_catalog

logger = logging.getLogger("tabiya.build")


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "public" / "catalog.json"
DEFAULT_NOTES = REPO_ROOT / "scripts" / "curated" / "notes.yml"
DEFAULT_CACHE = REPO_ROOT / "scripts" / ".cache"


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build tabiya opening catalog")
    p.add_argument("--refresh", action="store_true", help="re-fetch all caches")
    p.add_argument("--openings", default=None, help="comma-separated opening ids")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT, help="output JSON path")
    p.add_argument("--max-depth", type=int, default=None, help="override depth cap")
    p.add_argument("--notes", type=Path, default=DEFAULT_NOTES, help="overlay YAML path")
    p.add_argument("--cache-dir", type=Path, default=DEFAULT_CACHE, help="cache root")
    p.add_argument("--log-level", default="INFO", help="logging level")
    return p.parse_args(argv)


def build_for_spec(
    spec: OpeningSpec,
    explorer: ExplorerClient,
    id_minter: IdMinter,
    max_depth: int | None,
) -> tuple[Opening, list[Line]]:
    """Build the Opening + its Line(s) for one whitelist entry."""
    seed = seed_to_san(spec.seed_pgn)
    extended_lines = extend_with_branch(spec, seed, explorer, max_depth=max_depth)

    out_lines: list[Line] = []
    for idx, ext in enumerate(extended_lines):
        suffix = "main" if idx == 0 else "alt"
        line_id = id_minter.mint(slugify(f"{spec.id}-{suffix}"))
        line_name = "Main Line" if idx == 0 else "Alternative Line"
        out_lines.append(
            Line(
                id=line_id,
                opening_id=spec.id,
                name=line_name,
                moves=list(ext.moves),
                depth=len(ext.moves),
                end_fen=ext.end_fen,
                popularity=round(ext.popularity, 4),
                tags=list(spec.tags),
            )
        )

    opening = Opening(
        id=spec.id,
        name=spec.display_name,
        eco=spec.eco_range,
        color=spec.color,
        line_ids=[line.id for line in out_lines],
    )
    return opening, out_lines


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=args.log_level.upper(),
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        stream=sys.stderr,
    )

    cache_dir: Path = args.cache_dir
    tsv_cache = cache_dir / "openings-tsv"
    explorer_cache = cache_dir / "explorer"

    # 1. Fetch + parse TSVs. The naming backbone is consumed via the canonical
    #    seed_pgn declared in the whitelist; we still parse the upstream rows so
    #    they can be cross-referenced for ECO / display-name in future phases.
    try:
        tsv_paths = download_all(tsv_cache, refresh=args.refresh)
    except Exception as e:
        logger.error("Failed to fetch TSVs: %s", e)
        return 1
    tsv_rows: list[TsvRow] = parse_all(tsv_paths)
    logger.info("Parsed %d named opening rows from upstream TSVs", len(tsv_rows))

    # 2. Pick whitelist
    requested_ids = args.openings.split(",") if args.openings else None
    specs = filter_openings(requested_ids)
    if not specs:
        logger.error("No openings selected (filter %r yielded nothing)", requested_ids)
        return 1

    # 3. Extend each opening
    id_minter = IdMinter()
    openings: list[Opening] = []
    lines: list[Line] = []

    with ExplorerClient(explorer_cache) as explorer:
        for spec in specs:
            logger.info("Building %s (%s)", spec.id, spec.display_name)
            try:
                opening, opening_lines = build_for_spec(
                    spec, explorer, id_minter, args.max_depth
                )
            except NotImplementedError:
                logger.error(
                    "extender not implemented yet — implement extend_line + "
                    "extend_with_branch in scripts/tabiya_build/extender.py"
                )
                return 1
            openings.append(opening)
            lines.extend(opening_lines)

    # 4. Notes overlay
    overlays = load_notes(args.notes)
    lines = merge_into_lines(lines, overlays)

    # 5. Build + write catalog
    catalog = Catalog(version=build_version(), openings=openings, lines=lines)
    size = write_catalog(catalog, args.out)
    print_summary(catalog, size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
