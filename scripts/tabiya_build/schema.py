"""Pydantic v2 models for the catalog.

These are the single source of truth for the catalog shape (Constitution Article 5).
The TypeScript `OpeningRepository` types in Phase 0c mirror these 1:1.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Color = Literal["white", "black"]
Side = Literal["white", "black", "both"]


class KeySquare(BaseModel):
    """A square that matters strategically in the resulting middlegame."""

    square: str = Field(..., description="Algebraic square notation, e.g. 'd5'")
    note: str = Field(..., description="Short strategic role description")
    side: Side | None = Field(default=None, description="Which side fights for this square")


class Line(BaseModel):
    """A single linear opening line (Constitution Article 7 — no branching)."""

    id: str = Field(..., description="Stable slug, never renumbered (Article 6)")
    opening_id: str
    name: str
    moves: list[str] = Field(..., description="SAN moves (Article 9)")
    depth: int = Field(..., ge=1, le=20, description="Ply count, hard cap 20 (Article 8)")
    end_fen: str = Field(..., description="Position after the last move; reserved for AI coach")
    popularity: float = Field(..., ge=0.0, le=1.0)
    tags: list[str] = Field(default_factory=list)
    strategic_notes: list[str] = Field(default_factory=list)
    key_squares: list[KeySquare] = Field(default_factory=list)


class Opening(BaseModel):
    """An opening family (e.g. Ruy Lopez, Sicilian)."""

    id: str
    name: str
    eco: str = Field(..., description="ECO code or range, e.g. 'C60-C99'")
    color: Color = Field(..., description="Side the player drills")
    line_ids: list[str] = Field(default_factory=list)


class Catalog(BaseModel):
    """The full bundled catalog written to public/catalog.json."""

    version: str = Field(..., description="Build date in YYYY-MM-DD UTC")
    openings: list[Opening] = Field(default_factory=list)
    lines: list[Line] = Field(default_factory=list)
