"""FEN-keyed transposition index build step.

Walks every curated line, replays SAN moves, hashes each intermediate
position, and accumulates ``Map<fen_hash, Set<line_id>>``. Singleton entries
are dropped (a transposition is by definition shared by ≥2 lines).

Deterministic: same lines input → byte-identical JSON output (R5.5). Tested
in ``tests/python/transpositions/test_transposition.py``.

Hash algorithm: ``sha1`` of normalized FEN (drop halfmove + fullmove
counters), first 16 hex chars. Mirrored in TS at ``src/chess/fen-hash.ts``.
A shared fixture (``tests/fixtures/fen_hash_parity.json``) guarantees parity.
"""

from __future__ import annotations

import hashlib
import json
import logging
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import chess

from .schema import Line

logger = logging.getLogger(__name__)


# Sidecar schema version. Bump when the hash algorithm or normalization rule
# changes — the browser refuses to load a mismatched pair.
SIDECAR_SCHEMA_VERSION = 1
FEN_HASH_ALGO = "sha1-16"
FEN_NORMALIZATION = "drop-counters"


def normalize_fen(fen: str) -> str:
    """Strip halfmove + fullmove counters; keep placement, side, castling, ep.

    Collisions across move counts are intentional — two positions reached via
    different move orders should hash equal.
    """
    parts = fen.split()
    return " ".join(parts[:4])


def fen_hash(fen: str) -> str:
    """SHA-1 of normalized FEN, first 16 hex chars (8 bytes)."""
    digest = hashlib.sha1(normalize_fen(fen).encode("utf-8")).hexdigest()
    return digest[:16]


def build_transposition_index(lines: list[Line]) -> dict[str, list[str]]:
    """Build the FEN-hash → sorted list-of-line-ids index.

    - Walks every line, replays SAN, hashes each position from ply 1 to N.
    - Ply 0 (starting position) is INCLUDED in the per-line walk, then dropped
      via the singleton filter — every line shares ply 0, so it's a singleton
      from a user-meaningful perspective only if there's exactly one line.
      In practice with ≥2 lines, ply 0 IS in the index (all lineIds), and
      Phase 2b suppresses it on the UI side (R8.6).
      CHOICE: we keep ply 0 in the index for completeness; UI does the ply==0
      guard so the index is independent of UI semantics.
    """
    index: dict[str, set[str]] = defaultdict(set)
    for line in lines:
        board = chess.Board()
        # Include the starting position
        index[fen_hash(board.fen())].add(line.id)
        for san in line.moves:
            try:
                board.push_san(san)
            except (
                ValueError,
                chess.IllegalMoveError,
                chess.AmbiguousMoveError,
                chess.InvalidMoveError,
            ) as e:
                logger.warning("line %s: illegal SAN %s — stopping walk: %s", line.id, san, e)
                break
            index[fen_hash(board.fen())].add(line.id)
    # Drop singletons (R5.6); sort line_ids (R5.5 determinism).
    return {h: sorted(line_ids) for h, line_ids in index.items() if len(line_ids) >= 2}


def write_transposition_sidecar(
    index: dict[str, list[str]],
    out_path: Path,
    *,
    schema_version: int = SIDECAR_SCHEMA_VERSION,
    generated_at: str | None = None,
) -> int:
    """Write the sidecar JSON. Returns file size in bytes.

    Output schema:
        {
          "schema_version": <int>,
          "generated_at": "<ISO8601 UTC>",
          "fen_hash_algo": "sha1-16",
          "fen_normalization": "drop-counters",
          "index": { "<hash>": ["<lineId>", ...], ... }
        }

    Determinism: top-level keys sorted, line_ids within each entry sorted
    (the builder already sorts), JSON formatted with sort_keys=True so any
    later schema additions also get deterministic ordering.
    """
    out_path.parent.mkdir(parents=True, exist_ok=True)
    payload: dict[str, Any] = {
        "schema_version": schema_version,
        "generated_at": generated_at or datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fen_hash_algo": FEN_HASH_ALGO,
        "fen_normalization": FEN_NORMALIZATION,
        "index": {h: list(ids) for h, ids in sorted(index.items())},
    }
    body = json.dumps(payload, sort_keys=True, indent=2)
    if not body.endswith("\n"):
        body += "\n"
    out_path.write_text(body, encoding="utf-8")
    return out_path.stat().st_size
