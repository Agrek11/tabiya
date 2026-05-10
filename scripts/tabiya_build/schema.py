"""Pydantic v2 models for the catalog.

These are the single source of truth for the catalog shape (Constitution Article 5).
The TypeScript `OpeningRepository` types in Phase 0c mirror these 1:1.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Color = Literal["white", "black"]
Side = Literal["white", "black", "both"]
FamilyCategory = Literal[
    "open",
    "semi-open",
    "closed",
    "indian",
    "flank",
    "gambit",
    "uncategorized",
]


class KeySquare(BaseModel):
    """A square that matters strategically in the resulting middlegame."""

    square: str = Field(..., description="Algebraic square notation, e.g. 'd5'")
    note: str = Field(..., description="Short strategic role description")
    side: Side | None = Field(default=None, description="Which side fights for this square")


class ForkAnnotation(BaseModel):
    """A branching decision point inside a line (curated v2 hierarchy).

    Squashes sub-variations into the same Line node rather than spawning new
    nodes — users see the alternative SANs inline at ply N with a label.
    """

    ply_index: int = Field(..., ge=0, le=20, description="0-based index into Line.moves")
    alternatives: list[str] = Field(..., description="Alternative SAN moves at this ply")
    label: str = Field(..., description="Short label, e.g. 'Marshall Attack', 'Anti-Marshall'")
    rationale: str | None = Field(default=None, description="One-sentence why")


class Line(BaseModel):
    """A single linear opening line (Constitution Article 7 — no branching)."""

    id: str = Field(..., description="Stable slug, never renumbered (Article 6)")
    opening_id: str
    variation_id: str = Field(default="", description="Parent Variation.id (curated v2)")
    name: str
    moves: list[str] = Field(..., description="SAN moves (Article 9)")
    depth: int = Field(..., ge=1, le=20, description="Ply count, hard cap 20 (Article 8)")
    end_fen: str = Field(..., description="Position after the last move; reserved for AI coach")
    popularity: float = Field(..., ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)
    strategic_notes: list[str] = Field(default_factory=list)
    key_squares: list[KeySquare] = Field(default_factory=list)
    forks: list[ForkAnnotation] = Field(default_factory=list)


class Opening(BaseModel):
    """A single opening (e.g. Ruy Lopez, Sicilian Najdorf)."""

    id: str
    family_id: str = Field(..., description="Parent Family.id (Phase 0d.3)")
    name: str
    eco: str = Field(..., description="ECO code or range, e.g. 'C60-C99'")
    color: Color = Field(..., description="Side the player drills")
    line_ids: list[str] = Field(default_factory=list)
    is_gambit: bool = Field(default=False, description="True for true gambits (King's, Evans, etc)")


class Family(BaseModel):
    """A high-level group of openings (Phase 0d.3)."""

    id: str = Field(..., description="Stable slug, e.g. 'open-games', 'semi-open'")
    name: str
    category: FamilyCategory
    eco_range: str = Field(..., description="Composite range or representative ECO band")
    tier: int = Field(default=1, ge=1, le=3, description="1=must-have, 2=common, 3=offbeat")
    opening_ids: list[str] = Field(default_factory=list)


class Variation(BaseModel):
    """A named middle-layer between Family and Line (curated v2 hierarchy).

    Examples: 'Najdorf' under Sicilian, 'Berlin Defense' under Spanish,
    'Mar del Plata' under King's Indian. Each Variation has 1-3 child lines.
    """

    id: str = Field(..., description="Stable slug, e.g. 'sicilian-najdorf'")
    family_id: str
    name: str
    eco: str = Field(..., description="Single ECO code or sub-range")
    color: Color = Field(..., description="Side this is primarily drilled by")
    trunk_moves: list[str] = Field(
        default_factory=list,
        description="Shared move sequence shared by all child lines (display only)",
    )
    line_ids: list[str] = Field(default_factory=list)


class Preset(BaseModel):
    """A one-click repertoire loadout (Phase 1c)."""

    id: str
    name: str
    description: str
    tier_band: list[int] = Field(default_factory=list, description="1/2/3 tiers included")
    family_ids: list[str] = Field(
        default_factory=list, description="Explicit additions outside tier_band"
    )
    recommended_color: Literal["white-only", "black-only", "both"] = "both"


class Catalog(BaseModel):
    """The full bundled catalog written to public/catalog.json."""

    version: str = Field(..., description="Build date in YYYY-MM-DD UTC")
    families: list[Family] = Field(default_factory=list)
    variations: list[Variation] = Field(default_factory=list)
    openings: list[Opening] = Field(default_factory=list)
    lines: list[Line] = Field(default_factory=list)
    presets: list[Preset] = Field(default_factory=list)
