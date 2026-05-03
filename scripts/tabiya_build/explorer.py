"""Lichess Masters Opening Explorer client (cached, rate-limited, retried).

Endpoint: https://explorer.lichess.ovh/masters?fen=<FEN>
Docs:     https://lichess.org/api#tag/Opening-Explorer

Each response is cached under scripts/.cache/explorer/<sha1(fen)>.json so
reruns are deterministic and offline-friendly.

Constitution Article 1: httpx (BSD), tenacity (Apache-2) — both OSS.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

EXPLORER_URL = "https://explorer.lichess.ovh/masters"
MIN_INTERVAL_S = 0.25  # ≤ 4 rps, well under Lichess's 5 rps guidance

# Lichess requires a meaningful User-Agent on all API calls; anonymous / missing
# UA is rejected (often as 401) at their CDN edge.
USER_AGENT = "tabiya-build/0.1 (+https://github.com/Agrek11/tabiya)"


@dataclass(frozen=True)
class ExplorerMove:
    """One continuation reported by the Explorer API."""

    san: str
    uci: str
    white: int
    draws: int
    black: int

    @property
    def total_games(self) -> int:
        return self.white + self.draws + self.black


@dataclass(frozen=True)
class ExplorerResponse:
    """Parsed Explorer response (subset of fields we use)."""

    moves: list[ExplorerMove]
    white: int = 0
    draws: int = 0
    black: int = 0
    opening_name: str | None = None
    opening_eco: str | None = None
    raw: dict[str, Any] = field(default_factory=dict, repr=False, compare=False)

    @property
    def total_games(self) -> int:
        return self.white + self.draws + self.black


def _fen_hash(fen: str) -> str:
    return hashlib.sha1(fen.encode("utf-8")).hexdigest()


def _parse_response(data: dict[str, Any]) -> ExplorerResponse:
    moves_raw = data.get("moves", []) or []
    moves = [
        ExplorerMove(
            san=m.get("san", ""),
            uci=m.get("uci", ""),
            white=int(m.get("white", 0) or 0),
            draws=int(m.get("draws", 0) or 0),
            black=int(m.get("black", 0) or 0),
        )
        for m in moves_raw
    ]
    opening = data.get("opening") or {}
    return ExplorerResponse(
        moves=moves,
        white=int(data.get("white", 0) or 0),
        draws=int(data.get("draws", 0) or 0),
        black=int(data.get("black", 0) or 0),
        opening_name=opening.get("name") if isinstance(opening, dict) else None,
        opening_eco=opening.get("eco") if isinstance(opening, dict) else None,
        raw=data,
    )


class ExplorerClient:
    """Cached, rate-limited, retried client for Lichess Masters Explorer.

    Use as a context manager OR construct directly. The underlying httpx.Client
    is created lazily and closed by `close()` (and on context-manager exit).
    """

    def __init__(self, cache_dir: Path):
        self._cache_dir = cache_dir
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._client: httpx.Client | None = None
        self._last_call_monotonic = 0.0

    # --- context manager ---
    def __enter__(self) -> ExplorerClient:
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        self.close()

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    # --- public ---
    def fetch(self, fen: str) -> ExplorerResponse:
        """Return the Explorer response for `fen`, using the cache if present."""
        cache_path = self._cache_dir / f"{_fen_hash(fen)}.json"
        if cache_path.exists():
            data = json.loads(cache_path.read_text(encoding="utf-8"))
            return _parse_response(data)

        # Rate-limit
        elapsed = time.monotonic() - self._last_call_monotonic
        if elapsed < MIN_INTERVAL_S:
            time.sleep(MIN_INTERVAL_S - elapsed)

        data = self._http_get(fen)
        cache_path.write_text(json.dumps(data, indent=2), encoding="utf-8")
        self._last_call_monotonic = time.monotonic()
        return _parse_response(data)

    # --- internals ---
    def _ensure_client(self) -> httpx.Client:
        if self._client is None:
            headers: dict[str, str] = {
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            }
            token = os.getenv("LICHESS_API_TOKEN")
            if token:
                headers["Authorization"] = f"Bearer {token}"
            else:
                logger.warning(
                    "LICHESS_API_TOKEN not set — Lichess Explorer may reject "
                    "requests with 401. Generate a token at "
                    "https://lichess.org/account/oauth/token"
                )
            self._client = httpx.Client(timeout=15.0, headers=headers)
        return self._client

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(min=1, max=8),
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TransportError)),
        reraise=True,
    )
    def _http_get(self, fen: str) -> dict[str, Any]:
        client = self._ensure_client()
        logger.debug("Explorer GET %s", fen)
        resp = client.get(EXPLORER_URL, params={"fen": fen})
        if resp.status_code == 429:
            # Surface rate-limit as a retriable error.
            raise httpx.HTTPStatusError(
                "rate limited",
                request=resp.request,
                response=resp,
            )
        resp.raise_for_status()
        return resp.json()
