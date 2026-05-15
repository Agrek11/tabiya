"""Curated v2 builder — reads YAML source, emits Family/Variation/Line tree.

Replaces the curated whitelist + Lichess Explorer pipeline with hand-authored
families.yml + variations.yml + lines.yml. The chess-opening universe is
small enough (~30 families, ~100 variations, ~300 lines) to maintain by hand
with frequency-driven sanity checks.

Pipeline:
    1. Load families.yml      → Family list
    2. Load variations.yml    → Variation list (1 Opening synthesized per Variation)
    3. Load lines.yml         → Line list, parsed via python-chess for end_fen
    4. Validate refs          → every variation.family_id resolves; every
                                line.variation_id resolves; depth ≤ 20 ply
    5. Compute opening_ids    → variation.opening_id = variation.id (1:1 here);
                                family.opening_ids = ids of variations rooted in it
"""

from __future__ import annotations

import logging
import re
from pathlib import Path

import chess
import yaml

from .schema import Catalog, Family, ForkAnnotation, Line, Opening, Preset, Variation
from .slug import IdMinter, slugify

logger = logging.getLogger(__name__)

MAX_PLY = 20  # Constitution Article 8


def _parse_pgn_to_san(pgn: str) -> list[str]:
    """Parse a PGN string into a SAN list. Validates legality on a fresh board."""
    tokens = re.split(r"\s+", pgn.strip())
    moves: list[str] = []
    board = chess.Board()
    for tok in tokens:
        if not tok:
            continue
        if tok in {"1-0", "0-1", "1/2-1/2", "*"}:
            break
        if tok[0].isdigit() and "." in tok:
            stripped = tok.split(".", 1)[1].strip(".")
            if stripped == "":
                continue
            tok = stripped
        try:
            move = board.parse_san(tok)
        except (
            ValueError,
            chess.IllegalMoveError,
            chess.AmbiguousMoveError,
            chess.InvalidMoveError,
        ) as e:
            raise ValueError(f"illegal SAN token {tok!r} in pgn {pgn!r}: {e}") from e
        board.push(move)
        moves.append(tok)
    return moves


def _end_fen_for(moves: list[str]) -> str:
    board = chess.Board()
    for san in moves:
        board.push_san(san)
    return board.fen()


def load_families(path: Path) -> list[Family]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    out: list[Family] = []
    for entry in raw.get("families", []):
        out.append(
            Family(
                id=entry["id"],
                name=entry["name"],
                category=entry["category"],
                tier=int(entry.get("tier", 1)),
                eco_range=entry.get("eco_range", ""),
                opening_ids=[],  # filled later
            )
        )
    return out


def load_variations(path: Path) -> list[Variation]:
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    out: list[Variation] = []
    for entry in raw.get("variations", []):
        trunk = _parse_pgn_to_san(entry.get("trunk_pgn", ""))
        out.append(
            Variation(
                id=entry["id"],
                family_id=entry["family_id"],
                name=entry["name"],
                eco=entry["eco"],
                color=entry["color"],
                trunk_moves=trunk,
                line_ids=[],  # filled later
            )
        )
    return out


def load_presets(path: Path) -> list[Preset]:
    """Load presets.yml. Returns [] if file missing (back-compat)."""
    if not path.exists():
        return []
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    out: list[Preset] = []
    for entry in raw.get("presets", []):
        out.append(
            Preset(
                id=entry["id"],
                name=entry["name"],
                description=entry.get("description", ""),
                tier_band=list(entry.get("tier_band", [])),
                family_ids=list(entry.get("family_ids", [])),
                lines=list(entry.get("lines", [])),
                recommended_color=entry.get("recommended_color", "both"),
            )
        )
    return out


def load_lines(path: Path) -> list[tuple[str, Line]]:
    """Returns list of (variation_id, Line) tuples; opening_id filled later."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    out: list[tuple[str, Line]] = []
    for entry in raw.get("lines", []):
        san_moves = _parse_pgn_to_san(entry["pgn"])
        if len(san_moves) > MAX_PLY:
            raise ValueError(
                f"line {entry['id']!r} exceeds Article 8 cap "
                f"({len(san_moves)} > {MAX_PLY} ply)"
            )
        forks = [
            ForkAnnotation(
                ply_index=int(f["ply_index"]),
                alternatives=list(f["alternatives"]),
                label=f["label"],
                rationale=f.get("rationale"),
            )
            for f in entry.get("forks", [])
        ]
        line = Line(
            id=entry["id"],
            opening_id="",  # filled later
            variation_id=entry["variation_id"],
            name=entry["name"],
            moves=san_moves,
            depth=len(san_moves),
            end_fen=_end_fen_for(san_moves),
            popularity=float(entry.get("popularity", 0.0)),
            tags=list(entry.get("tags", [])),
            strategic_notes=list(entry.get("strategic_notes", [])),
            key_squares=[],
            forks=forks,
        )
        out.append((entry["variation_id"], line))
    return out


def build(
    families_path: Path,
    variations_path: Path,
    lines_path: Path,
    presets_path: Path | None = None,
) -> tuple[list[Family], list[Variation], list[Opening], list[Line], list[Preset]]:
    """Build the full Family/Variation/Opening/Line set from YAMLs.

    Synthesizes one Opening per Variation (1:1) so the existing Opening
    layer continues to work. opening.id == variation.id; opening.name and
    opening.eco mirror the variation. Family.opening_ids enumerates all
    variation-derived opening ids that belong to it.
    """
    families = load_families(families_path)
    variations = load_variations(variations_path)
    line_pairs = load_lines(lines_path)

    family_by_id = {f.id: f for f in families}
    variation_by_id = {v.id: v for v in variations}

    # Validate cross-refs
    for v in variations:
        if v.family_id not in family_by_id:
            raise ValueError(
                f"variation {v.id!r} references unknown family_id {v.family_id!r}"
            )
    for variation_id, line in line_pairs:
        if variation_id not in variation_by_id:
            raise ValueError(
                f"line {line.id!r} references unknown variation_id {variation_id!r}"
            )

    # Synthesize Opening per Variation
    minter = IdMinter()
    openings: list[Opening] = []
    lines: list[Line] = []
    for v in variations:
        opening_id = minter.mint(slugify(v.id))
        opening = Opening(
            id=opening_id,
            family_id=v.family_id,
            name=v.name,
            eco=v.eco,
            color=v.color,
            line_ids=[],
            is_gambit="gambit" in v.name.lower(),
        )
        openings.append(opening)

    opening_by_variation = {v.id: o for v, o in zip(variations, openings, strict=True)}

    # Attach lines to their parent Opening + Variation
    for variation_id, line in line_pairs:
        opening = opening_by_variation[variation_id]
        line_with_refs = line.model_copy(update={"opening_id": opening.id})
        opening.line_ids.append(line_with_refs.id)
        variation_by_id[variation_id].line_ids.append(line_with_refs.id)
        lines.append(line_with_refs)

    # Wire variation_ids onto Family.opening_ids in declared order
    for fam in families:
        fam.opening_ids = [
            opening_by_variation[v.id].id
            for v in variations
            if v.family_id == fam.id
        ]

    presets = load_presets(presets_path) if presets_path is not None else []

    logger.info(
        "Curated v2 build: %d families, %d variations, %d lines, %d presets",
        len(families),
        len(variations),
        len(lines),
        len(presets),
    )
    return families, variations, openings, lines, presets


def build_catalog(
    families_path: Path,
    variations_path: Path,
    lines_path: Path,
    version: str,
) -> Catalog:
    families, variations, openings, lines = build(
        families_path, variations_path, lines_path
    )
    return Catalog(
        version=version,
        families=families,
        variations=variations,
        openings=openings,
        lines=lines,
    )
