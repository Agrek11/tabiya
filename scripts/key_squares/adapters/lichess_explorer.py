"""Lichess Opening Explorer adapter.

License: ODbL-1.0 (Lichess public database). The Explorer API returns JSON
keyed by position; we surface the canonical opening name + (when present)
the ECO-code commentary that the Explorer exposes as opening metadata.

Discovery is FEN-based: the canonical FEN after the line's main moves is the
lookup key (one URL per opening). ``fetch`` calls the public Explorer API
endpoint; robots + rate limit are enforced by the driver.

Note: Lichess Explorer's primary purpose is move-tree statistics, not
strategic prose. Output is intentionally thin — usually 1-2 sentences of
opening metadata. The LLM extractor uses Wikipedia for the bulk of context
and Lichess for grounding the canonical opening name.
"""

from __future__ import annotations

import logging
from typing import Final

import httpx

from ..lib.normalize import normalize_chunk
from .base import ProseChunk

logger = logging.getLogger(__name__)

LICHESS_EXPLORER_BASE: Final[str] = "https://explorer.lichess.ovh"


class LichessExplorerAdapter:
    """SourceAdapter for Lichess Opening Explorer JSON API."""

    name = "lichess_explorer"
    license = "ODbL-1.0"
    base_url = LICHESS_EXPLORER_BASE

    def __init__(
        self,
        *,
        http_client: httpx.Client | None = None,
        endpoint: str = "/masters",
    ) -> None:
        self._client = http_client or httpx.Client(
            timeout=15.0,
            headers={"User-Agent": "tabiya-key-squares-scraper/0.1"},
            follow_redirects=True,
        )
        self._endpoint = endpoint

    def discover(self, opening_slug: str, opening_name: str) -> list[str]:
        """No URL list here — driver passes the FEN via :meth:`fetch_for_fen`.

        Returns an empty list; callers must use the FEN-aware path. The driver
        special-cases this adapter, supplying ``fen_after_main_line`` from the
        opening record.
        """
        # CHOICE: we expose a parallel `fetch_for_fen` path; `discover` returns
        # empty to keep the simple driver loop honest about what this adapter
        # needs (a FEN, not an opening name).
        return []

    def fetch(self, url: str) -> ProseChunk | None:
        """Fetch a precomputed Explorer URL (e.g. ``…/masters?fen=…``)."""
        try:
            resp = self._client.get(url)
        except httpx.HTTPError as e:
            logger.warning("lichess fetch failed for %s: %s", url, e)
            return None
        if resp.status_code != 200:
            return None
        try:
            payload = resp.json()
        except ValueError:
            return None
        text = self._payload_to_text(payload)
        if not text:
            return None
        return ProseChunk(
            source_url=url,
            license=self.license,
            text=normalize_chunk(text),
        )

    def url_for_fen(self, fen: str) -> str:
        """Build the Explorer URL for a FEN. Spaces in FEN are quoted by httpx."""
        query = httpx.URL("").copy_with(params={"fen": fen}).query.decode()
        return f"{self.base_url}{self._endpoint}?{query}"

    @staticmethod
    def _payload_to_text(payload: dict) -> str:
        """Squeeze a short prose blurb out of the Explorer JSON.

        Schema (Lichess Explorer): includes ``opening: {eco, name}`` and a
        ``moves[]`` array keyed by SAN. We surface eco + name as the canonical
        opening tag and nothing more — strategic prose is not the Explorer's
        job.
        """
        opening = payload.get("opening") or {}
        eco = opening.get("eco") or ""
        name = opening.get("name") or ""
        if not name:
            return ""
        if eco:
            return f"Lichess Opening Explorer identifies this position as {name} (ECO {eco})."
        return f"Lichess Opening Explorer identifies this position as {name}."
