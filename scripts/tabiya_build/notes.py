"""Hand-curated strategic notes + key squares overlay.

Reads `scripts/curated/notes.yml` (optional) and merges its entries into the
generated catalog. Curation is incremental and can lag behind the catalog
schema; missing entries simply leave `strategic_notes` and `key_squares`
empty on the target Line.

YAML schema:

    ruy-lopez-closed-main:
      strategic_notes:
        - "Black aims for the d5 break only after White overextends kingside."
      key_squares:
        - { square: d5, note: "central light-square fight", side: both }
        - { square: f5, note: "kingside lever for Black", side: black }

Constitution Article 6 — line IDs are stable, so notes keyed by line id are
durable across catalog refreshes.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path

import yaml

from .schema import KeySquare, Line

logger = logging.getLogger(__name__)


@dataclass
class LineOverlay:
    strategic_notes: list[str] = field(default_factory=list)
    key_squares: list[KeySquare] = field(default_factory=list)


def load_notes(path: Path) -> dict[str, LineOverlay]:
    """Load the YAML overlay file. Returns {} if the file does not exist."""
    if not path.exists():
        logger.info("No curated notes at %s — proceeding with empty overlays", path)
        return {}

    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    if not isinstance(raw, dict):
        raise ValueError(f"{path} must be a YAML mapping at the top level")

    overlays: dict[str, LineOverlay] = {}
    for line_id, body in raw.items():
        if not isinstance(body, dict):
            logger.warning("Skipping notes for %r — body is not a mapping", line_id)
            continue
        notes_list = body.get("strategic_notes") or []
        squares_list = body.get("key_squares") or []
        squares = [
            KeySquare(
                square=item["square"],
                note=item["note"],
                side=item.get("side"),
            )
            for item in squares_list
            if isinstance(item, dict) and "square" in item and "note" in item
        ]
        overlays[line_id] = LineOverlay(
            strategic_notes=[str(n) for n in notes_list],
            key_squares=squares,
        )
    return overlays


def merge_into_lines(lines: list[Line], overlays: dict[str, LineOverlay]) -> list[Line]:
    """Return a new list of Line with overlays applied where a line_id matches."""
    by_id = {line.id: line for line in lines}
    unused = set(overlays.keys()) - set(by_id.keys())
    for missing in unused:
        logger.warning("notes.yml references unknown line id %r — ignoring", missing)

    merged: list[Line] = []
    for line in lines:
        ov = overlays.get(line.id)
        if ov is None:
            merged.append(line)
            continue
        merged.append(
            line.model_copy(
                update={
                    "strategic_notes": list(ov.strategic_notes),
                    "key_squares": list(ov.key_squares),
                }
            )
        )
    return merged
