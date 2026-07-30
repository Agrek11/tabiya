"""Curated key_squares.yml loader + license audit + opening join.

Pipeline order (called from build_catalog.py):
    1. ``load_curated_key_squares(path)``  — schema validation
    2. ``license_audit(curated, sources_yml)`` — Article 1 enforcement
    3. ``join_to_openings(openings, curated)`` — Article 6 stable-slug join

The curated YAML is the ONLY artifact the build reads from the key-squares
pipeline (R3.9). Scraped/pending/rejected dirs are reviewer-only state.
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Literal
from urllib.parse import urlparse

import yaml
from pydantic import BaseModel, Field, ValidationError

from .schema import Opening

logger = logging.getLogger(__name__)


KeySquareRole = Literal["outpost", "weak", "tension", "control"]
KeySquareColor = Literal["white", "black"]


class BuildError(Exception):
    """Raised when the curated key-squares input violates a build invariant."""


class KeySquareRecord(BaseModel):
    """One key-square attached to an opening at its canonical position.

    Distinct from the Line-level ``KeySquare`` in ``schema.py`` (which is the
    legacy free-text annotation) — this is the structured, role-typed version
    that Phase 2b UI renders as a spotlight overlay.
    """

    square: str = Field(..., pattern=r"^[a-h][1-8]$")
    role: KeySquareRole
    for_color: KeySquareColor
    rationale: str = Field(..., max_length=280)
    source_url: str = Field(..., min_length=1)


class OpeningKeySquares(BaseModel):
    """Per-opening curated key-square block."""

    fen_canonical: str
    squares: list[KeySquareRecord] = Field(default_factory=list)


def load_curated_key_squares(path: Path) -> dict[str, OpeningKeySquares]:
    """Load + validate ``scripts/curated/key_squares.yml``.

    Returns ``{}`` when the file is missing (no curated content yet — frontend
    graceful-degrades per R4.6). Build fails on malformed entries (R4.2).
    """
    if not path.exists():
        logger.info("key_squares.yml not found (%s) — no curated content", path)
        return {}
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    out: dict[str, OpeningKeySquares] = {}
    for slug, payload in raw.items():
        try:
            out[slug] = OpeningKeySquares.model_validate(payload)
        except ValidationError as e:
            raise BuildError(f"key_squares.yml: malformed entry {slug!r}: {e}") from e
    return out


def _load_permissive_hosts(sources_yml: Path) -> set[str]:
    """Derive the set of audited hosts from sources.yml.

    Each ``base_url`` in sources.yml maps to one canonical host. Any
    ``source_url`` in curated YAML must trace to one of these hosts.
    """
    if not sources_yml.exists():
        raise BuildError(f"sources.yml missing: {sources_yml}")
    raw = yaml.safe_load(sources_yml.read_text(encoding="utf-8")) or {}
    hosts: set[str] = set()
    for entry in raw.get("sources", []):
        host = urlparse(entry["base_url"]).netloc
        if host:
            hosts.add(host)
    return hosts


def license_audit(curated: dict[str, OpeningKeySquares], sources_yml: Path) -> None:
    """Article 1: every source_url host must trace to a permissive sources.yml entry.

    Raises :class:`BuildError` with explicit context on the first violation.
    """
    permissive_hosts = _load_permissive_hosts(sources_yml)
    if not permissive_hosts:
        raise BuildError(f"sources.yml at {sources_yml} declares no permissive hosts")
    for slug, rec in curated.items():
        for sq in rec.squares:
            host = urlparse(sq.source_url).netloc
            if not host:
                raise BuildError(f"{slug}: empty host in source_url {sq.source_url!r}")
            if host not in permissive_hosts:
                raise BuildError(
                    f"{slug}: unaudited host {host!r} in source_url "
                    f"{sq.source_url!r} — add to sources.yml or remove from "
                    "curated/key_squares.yml"
                )


def join_to_openings(
    openings: list[Opening],
    curated: dict[str, OpeningKeySquares],
) -> dict[str, list[dict]]:
    """Article 6: join curated key-squares onto Openings by stable slug.

    Unknown opening_slug → :class:`BuildError`. Known slugs → returns a map
    ``{opening_id: [record_dicts]}`` so the writer can serialize without
    requiring an Opening.key_squares Pydantic field (additive only).

    The caller is responsible for attaching the result to the final JSON
    catalog payload (see ``writer.attach_opening_key_squares``).
    """
    known_slugs = {o.id for o in openings}
    unknown = [slug for slug in curated if slug not in known_slugs]
    if unknown:
        raise BuildError(
            "key_squares.yml references unknown opening_slug(s): " + ", ".join(sorted(unknown))
        )

    out: dict[str, list[dict]] = {}
    for slug, rec in curated.items():
        out[slug] = [sq.model_dump() for sq in rec.squares]
    return out
