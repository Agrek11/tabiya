"""Feature-extraction orchestrator — Phase 4b (design-4b §module map).

``extract_features(board)`` returns the full ``PositionFeatures`` dict.
Deterministic: pure function of the position; all arrays sorted; no
timestamps. Bump ``EXTRACTOR_VERSION`` on ANY definitional change — the
sidecar build recomputes everything on a version bump.
"""

from __future__ import annotations

from typing import Any

import chess

from .activity import activity
from .center_space import center_space
from .classification import classification
from .files_diagonals import files_diagonals
from .king_safety import king_safety
from .material import material
from .motifs import motifs
from .pawns import pawn_structure
from .tactics_geometry import tactics_geometry

EXTRACTOR_VERSION = 5  # v5: 4c.2 `classification` group (center type + structures)


def extract_features(board: chess.Board) -> dict[str, Any]:
    return {
        "version": EXTRACTOR_VERSION,
        "material": material(board),
        "pawns": pawn_structure(board),
        "king_safety": king_safety(board),
        "center_space": center_space(board),
        "files_diagonals": files_diagonals(board),
        "activity": activity(board),
        "tactics_geometry": tactics_geometry(board),
        "motifs": motifs(board),
        "classification": classification(board),
    }
