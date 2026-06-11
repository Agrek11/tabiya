"""features.json sidecar emission — Phase 4b (tasks 3.1/3.2).

Walks every curated line, extracts features for each position (ply 1..N),
dedupes by the Phase 2 normalized-FEN hash (transpositions collapse to one
entry), and writes a deterministic JSON sidecar. Incremental: entries from a
previous sidecar are reused when ``extractor_version`` matches.
"""

from __future__ import annotations

import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import chess

from ..schema import Line
from ..transposition import fen_hash
from .extract import EXTRACTOR_VERSION, extract_features

logger = logging.getLogger(__name__)

SIDECAR_SCHEMA_VERSION = 1


def build_features_index(
    lines: list[Line],
    previous: dict[str, Any] | None = None,
) -> dict[str, dict[str, Any]]:
    reusable: dict[str, dict[str, Any]] = {}
    if previous and previous.get("extractor_version") == EXTRACTOR_VERSION:
        reusable = previous.get("index", {})

    index: dict[str, dict[str, Any]] = {}
    fresh = 0
    for line in lines:
        board = chess.Board()
        for san in line.moves:
            board.push_san(san)
            h = fen_hash(board.fen())
            if h in index:
                continue  # transposition / shared prefix — already extracted
            if h in reusable:
                index[h] = reusable[h]
            else:
                index[h] = extract_features(board)
                fresh += 1
    logger.info(
        "features: %d unique positions (%d freshly extracted, %d reused)",
        len(index),
        fresh,
        len(index) - fresh,
    )
    return index


def write_features_sidecar(
    index: dict[str, dict[str, Any]],
    out_path: Path,
) -> None:
    payload = {
        "schema_version": SIDECAR_SCHEMA_VERSION,
        "extractor_version": EXTRACTOR_VERSION,
        "generated_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "index": index,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    # sort_keys → byte-identical output for identical inputs (R7.4); the
    # generated_at header is the only varying field and sits outside `index`.
    out_path.write_text(json.dumps(payload, sort_keys=True, separators=(",", ":")) + "\n")
    logger.info("features sidecar written: %s (%d positions)", out_path, len(index))


def read_previous_sidecar(path: Path) -> dict[str, Any] | None:
    try:
        return json.loads(path.read_text())
    except (OSError, json.JSONDecodeError):
        return None
