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


@dataclass(frozen=True)
class OpeningSpec:
    """Static declaration of an opening to include in the catalog."""

    id: str
    display_name: str
    eco_range: str
    color: Color
    seed_pgn: str
    depth_override: int | None = None
    tags: tuple[str, ...] = ()


DEFAULT_DEPTH = 18


# Order here is the order they appear in catalog.json (insertion-preserving).
TARGET_OPENINGS: list[OpeningSpec] = [
    # --- 1.e4 e5 family (white attacks) ---
    OpeningSpec(
        id="ruy-lopez",
        display_name="Ruy Lopez",
        eco_range="C60-C99",
        color="white",
        seed_pgn="1. e4 e5 2. Nf3 Nc6 3. Bb5",
        tags=("classical", "main-line"),
    ),
    OpeningSpec(
        id="italian-game",
        display_name="Italian Game",
        eco_range="C50-C59",
        color="white",
        seed_pgn="1. e4 e5 2. Nf3 Nc6 3. Bc4",
        tags=("classical",),
    ),
    OpeningSpec(
        id="vienna-game",
        display_name="Vienna Game",
        eco_range="C25-C29",
        color="white",
        seed_pgn="1. e4 e5 2. Nc3",
        tags=("aggressive",),
    ),
    # --- 1.e4 (other) — black defenses ---
    OpeningSpec(
        id="sicilian-defense",
        display_name="Sicilian Defense",
        eco_range="B20-B99",
        color="black",
        seed_pgn="1. e4 c5",
        tags=("sharp", "main-line"),
    ),
    OpeningSpec(
        id="sicilian-najdorf",
        display_name="Sicilian Najdorf",
        eco_range="B90-B99",
        color="black",
        seed_pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6",
        depth_override=20,
        tags=("sharp", "tactical"),
    ),
    OpeningSpec(
        id="sicilian-dragon",
        display_name="Sicilian Dragon",
        eco_range="B70-B79",
        color="black",
        seed_pgn="1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6",
        depth_override=20,
        tags=("sharp", "tactical"),
    ),
    OpeningSpec(
        id="french-defense",
        display_name="French Defense",
        eco_range="C00-C19",
        color="black",
        seed_pgn="1. e4 e6",
        tags=("solid",),
    ),
    OpeningSpec(
        id="caro-kann",
        display_name="Caro-Kann Defense",
        eco_range="B10-B19",
        color="black",
        seed_pgn="1. e4 c6",
        depth_override=16,
        tags=("solid", "positional"),
    ),
    OpeningSpec(
        id="scandinavian",
        display_name="Scandinavian Defense",
        eco_range="B01",
        color="black",
        seed_pgn="1. e4 d5",
        tags=("offbeat",),
    ),
    OpeningSpec(
        id="alekhine-defense",
        display_name="Alekhine's Defense",
        eco_range="B02-B05",
        color="black",
        seed_pgn="1. e4 Nf6",
        tags=("offbeat", "hypermodern"),
    ),
    OpeningSpec(
        id="pirc-defense",
        display_name="Pirc Defense",
        eco_range="B07-B09",
        color="black",
        seed_pgn="1. e4 d6",
        tags=("hypermodern",),
    ),
    # --- 1.d4 family ---
    OpeningSpec(
        id="queens-gambit",
        display_name="Queen's Gambit",
        eco_range="D06-D69",
        color="white",
        seed_pgn="1. d4 d5 2. c4",
        tags=("classical", "main-line"),
    ),
    OpeningSpec(
        id="slav-defense",
        display_name="Slav Defense",
        eco_range="D10-D19",
        color="black",
        seed_pgn="1. d4 d5 2. c4 c6",
        tags=("solid",),
    ),
    OpeningSpec(
        id="kings-indian",
        display_name="King's Indian Defense",
        eco_range="E60-E99",
        color="black",
        seed_pgn="1. d4 Nf6 2. c4 g6",
        tags=("hypermodern", "fighting"),
    ),
    OpeningSpec(
        id="nimzo-indian",
        display_name="Nimzo-Indian Defense",
        eco_range="E20-E59",
        color="black",
        seed_pgn="1. d4 Nf6 2. c4 e6 3. Nc3 Bb4",
        tags=("classical", "positional"),
    ),
    OpeningSpec(
        id="london-system",
        display_name="London System",
        eco_range="D02",
        color="white",
        seed_pgn="1. d4 d5 2. Nf3 Nf6 3. Bf4",
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
        tags=("flank",),
    ),
    OpeningSpec(
        id="birds-opening",
        display_name="Bird's Opening",
        eco_range="A02-A03",
        color="white",
        seed_pgn="1. f4",
        tags=("flank", "offbeat"),
    ),
]


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
