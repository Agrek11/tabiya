"""Catalog JSON writer + summary printer."""

from __future__ import annotations

import logging
from datetime import UTC, datetime
from pathlib import Path

from .schema import Catalog

logger = logging.getLogger(__name__)


def build_version() -> str:
    """UTC date stamp in YYYY-MM-DD form (Requirement 7.2)."""
    return datetime.now(UTC).strftime("%Y-%m-%d")


def write_catalog(catalog: Catalog, out_path: Path) -> int:
    """Write the catalog as pretty-printed JSON. Returns final byte size."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    body = catalog.model_dump_json(indent=2)
    if not body.endswith("\n"):
        body += "\n"
    out_path.write_text(body, encoding="utf-8")
    return out_path.stat().st_size


def print_summary(catalog: Catalog, file_size_bytes: int) -> None:
    """Print a one-block summary to stdout."""
    n_openings = len(catalog.openings)
    n_lines = len(catalog.lines)
    print("─" * 60)
    print("tabiya catalog build")
    print(f"  version:    {catalog.version}")
    print(f"  openings:   {n_openings}")
    print(f"  lines:      {n_lines}")
    print(f"  file size:  {file_size_bytes:,} bytes")
    print("─" * 60)
