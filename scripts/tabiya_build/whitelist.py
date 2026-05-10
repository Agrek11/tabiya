"""Curated whitelist of target openings.

15-20 popular openings driving the catalog. Each entry declares the canonical
naming sequence (PGN), the ECO range, the side the player drills, and an
optional depth override.

Default depth: 18 ply.
Sharp tactical lines: 20 ply (manual override).
Quiet positional lines: 16 ply (manual override).

See specs/phase-0b-catalog-build/requirements.md Requirement 2.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

Color = Literal["white", "black"]
FamilyCategory = Literal[
    "open",
    "semi-open",
    "closed",
    "indian",
    "flank",
    "gambit",
    "uncategorized",
]


@dataclass(frozen=True)
class OpeningSpec:
    """Static declaration of an opening to include in the catalog."""

    id: str
    display_name: str
    eco_range: str
    color: Color
    seed_pgn: str
    family_id: str = ""
    is_gambit: bool = False
    depth_override: int | None = None
    tags: tuple[str, ...] = ()


@dataclass(frozen=True)
class FamilySpec:
    """Static declaration of an opening family (Phase 0d.3)."""

    id: str
    display_name: str
    category: FamilyCategory
    eco_range: str


DEFAULT_DEPTH = 18


# Family declarations. Order = display order in catalog.json + Repertoire UX.
TARGET_FAMILIES: list[FamilySpec] = [
    FamilySpec("open-games", "Open Games", "open", "C20-C99"),
    FamilySpec("semi-open", "Semi-Open Games", "semi-open", "B00-B99 / C00-C19"),
    FamilySpec("closed-games", "Closed Games", "closed", "D00-D69"),
    FamilySpec("indian-defenses", "Indian Defenses", "indian", "E00-E99"),
    FamilySpec("flank", "Flank Openings", "flank", "A00-A39"),
    FamilySpec("gambits", "Gambits", "gambit", ""),
    FamilySpec("uncategorized", "Uncategorized", "uncategorized", ""),
]


# Order here is the order they appear in catalog.json (insertion-preserving).
TARGET_OPENINGS: list[OpeningSpec] = [
    # --- 1.e4 e5 family (white attacks) ---
    OpeningSpec(
        id="ruy-lopez",
        display_name="Ruy Lopez",
        eco_range="C60-C99",
        color="white",
        seed_pgn="1. e4 e5 2. Nf3 Nc6 3. Bb5",
        family_id="open-games",
        tags=("classical", "main-line"),
    ),
    OpeningSpec(
        id="italian-game",
        display_name="Italian Game",
        eco_range="C50-C59",
        color="white",
        seed_pgn="1. e4 e5 2. Nf3 Nc6 3. Bc4",
        family_id="open-games",
        tags=("classical",),
    ),
    OpeningSpec(
        id="vienna-game",
        display_name="Vienna Game",
        eco_range="C25-C29",
        color="white",
        seed_pgn="1. e4 e5 2. Nc3",
        family_id="open-games",
        tags=("aggressive",),
    ),
    # --- 1.e4 (other) — black defenses ---
    OpeningSpec(
        id="sicilian-defense",
        display_name="Sicilian Defense",
        eco_range="B20-B99",
        color="black",
        seed_pgn="1. e4 c5",
        family_id="semi-open",
        tags=("sharp", "main-line"),
    ),
    OpeningSpec(
        id="sicilian-najdorf",
        display_name="Sicilian Najdorf",
        eco_range="B90-B99",
        color="black",
        seed_pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6",
        family_id="semi-open",
        depth_override=20,
        tags=("sharp", "tactical"),
    ),
    OpeningSpec(
        id="sicilian-dragon",
        display_name="Sicilian Dragon",
        eco_range="B70-B79",
        color="black",
        seed_pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6",
        family_id="semi-open",
        depth_override=20,
        tags=("sharp", "tactical"),
    ),
    OpeningSpec(
        id="french-defense",
        display_name="French Defense",
        eco_range="C00-C19",
        color="black",
        seed_pgn="1. e4 e6",
        family_id="semi-open",
        tags=("solid",),
    ),
    OpeningSpec(
        id="caro-kann",
        display_name="Caro-Kann Defense",
        eco_range="B10-B19",
        color="black",
        seed_pgn="1. e4 c6",
        family_id="semi-open",
        depth_override=16,
        tags=("solid", "positional"),
    ),
    OpeningSpec(
        id="scandinavian",
        display_name="Scandinavian Defense",
        eco_range="B01",
        color="black",
        seed_pgn="1. e4 d5",
        family_id="semi-open",
        tags=("offbeat",),
    ),
    OpeningSpec(
        id="alekhine-defense",
        display_name="Alekhine's Defense",
        eco_range="B02-B05",
        color="black",
        seed_pgn="1. e4 Nf6",
        family_id="semi-open",
        tags=("offbeat", "hypermodern"),
    ),
    OpeningSpec(
        id="pirc-defense",
        display_name="Pirc Defense",
        eco_range="B07-B09",
        color="black",
        seed_pgn="1. e4 d6",
        family_id="semi-open",
        tags=("hypermodern",),
    ),
    # --- 1.d4 family ---
    OpeningSpec(
        id="queens-gambit",
        display_name="Queen's Gambit",
        eco_range="D06-D69",
        color="white",
        seed_pgn="1. d4 d5 2. c4",
        family_id="closed-games",
        tags=("classical", "main-line"),
    ),
    OpeningSpec(
        id="slav-defense",
        display_name="Slav Defense",
        eco_range="D10-D19",
        color="black",
        seed_pgn="1. d4 d5 2. c4 c6",
        family_id="closed-games",
        tags=("solid",),
    ),
    OpeningSpec(
        id="kings-indian",
        display_name="King's Indian Defense",
        eco_range="E60-E99",
        color="black",
        seed_pgn="1. d4 Nf6 2. c4 g6",
        family_id="indian-defenses",
        tags=("hypermodern", "fighting"),
    ),
    OpeningSpec(
        id="nimzo-indian",
        display_name="Nimzo-Indian Defense",
        eco_range="E20-E59",
        color="black",
        seed_pgn="1. d4 Nf6 2. c4 e6 3. Nc3 Bb4",
        family_id="indian-defenses",
        tags=("classical", "positional"),
    ),
    OpeningSpec(
        id="london-system",
        display_name="London System",
        eco_range="D02",
        color="white",
        seed_pgn="1. d4 d5 2. Nf3 Nf6 3. Bf4",
        family_id="closed-games",
        depth_override=16,
        tags=("system", "quiet"),
    ),
    # --- 1.c4 / 1.f4 / 1.b3 (white systems) ---
    OpeningSpec(
        id="english-opening",
        display_name="English Opening",
        eco_range="A10-A39",
        color="white",
        seed_pgn="1. c4",
        family_id="flank",
        tags=("flank",),
    ),
    OpeningSpec(
        id="birds-opening",
        display_name="Bird's Opening",
        eco_range="A02-A03",
        color="white",
        seed_pgn="1. f4",
        family_id="flank",
        tags=("flank", "offbeat"),
    ),
]


def get_family(family_id: str) -> FamilySpec | None:
    """Return the FamilySpec with the given id, or None if not found."""
    for fam in TARGET_FAMILIES:
        if fam.id == family_id:
            return fam
    return None


def get_opening(opening_id: str) -> OpeningSpec | None:
    """Return the OpeningSpec with the given id, or None if not found."""
    for spec in TARGET_OPENINGS:
        if spec.id == opening_id:
            return spec
    return None


def filter_openings(ids: list[str] | None) -> list[OpeningSpec]:
    """Return whitelist filtered by ids (or full list when None)."""
    if ids is None:
        return list(TARGET_OPENINGS)
    requested = set(ids)
    return [s for s in TARGET_OPENINGS if s.id in requested]
