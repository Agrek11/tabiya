"""Wikipedia chess-opening adapter.

License: CC-BY-SA-4.0 (declared in sources.yml). Source URLs are stable
``/wiki/<title>`` paths.

Discovery strategy: derive a small set of likely title slugs from the opening
name; let the driver iterate them. ``fetch`` issues an HTTPS GET, extracts the
first body paragraphs, normalizes the prose, and returns a single ProseChunk
with the canonical Wikipedia URL.

Network calls are made via httpx (already a runtime build dep). robots.txt
and rate limit are enforced by the driver (``scrape.py``), not here.
"""

from __future__ import annotations

import logging
import re
from typing import Final
from urllib.parse import quote

import httpx

from ..lib.normalize import cap_per_opening, is_substantive, normalize_chunk
from .base import ProseChunk

logger = logging.getLogger(__name__)

WIKIPEDIA_BASE: Final[str] = "https://en.wikipedia.org"


class WikipediaAdapter:
    """SourceAdapter for English Wikipedia chess-opening articles."""

    name = "wikipedia"
    license = "CC-BY-SA-4.0"
    base_url = WIKIPEDIA_BASE

    def __init__(self, *, http_client: httpx.Client | None = None) -> None:
        # httpx.Client is injectable for tests (responses/httpx_mock).
        self._client = http_client or httpx.Client(
            timeout=15.0,
            headers={"User-Agent": "tabiya-key-squares-scraper/0.1"},
            follow_redirects=True,
        )

    # --- discovery ---------------------------------------------------------

    def discover(self, opening_slug: str, opening_name: str) -> list[str]:
        """Return candidate Wikipedia URLs for the opening.

        The opening's display name is the primary signal; we also try a slug-
        derived variant to handle accent-stripped titles.
        """
        candidates: list[str] = []
        seen: set[str] = set()

        for raw_title in self._title_candidates(opening_name, opening_slug):
            title = raw_title.strip().replace(" ", "_")
            if not title or title in seen:
                continue
            seen.add(title)
            candidates.append(f"{self.base_url}/wiki/{quote(title)}")
        return candidates

    @staticmethod
    def _title_candidates(opening_name: str, opening_slug: str) -> list[str]:
        out = [opening_name]
        # "Ruy López, Closed Variation" → "Ruy Lopez"
        primary = re.split(r"[,:\-(]", opening_name, maxsplit=1)[0].strip()
        if primary and primary != opening_name:
            out.append(primary)
        # slug-derived (lossy but useful for ASCII titles)
        slug_words = opening_slug.replace("-", " ").title()
        if slug_words and slug_words not in out:
            out.append(slug_words)
        return out

    # --- fetch -------------------------------------------------------------

    def fetch(self, url: str) -> ProseChunk | None:
        """Pull the article, extract opening prose, normalize."""
        try:
            resp = self._client.get(url)
        except httpx.HTTPError as e:
            logger.warning("wikipedia fetch failed for %s: %s", url, e)
            return None

        if resp.status_code == 404:
            return None
        if resp.status_code != 200:
            logger.warning("wikipedia non-200 (%d) for %s — skipping", resp.status_code, url)
            return None

        html = resp.text
        if self._is_disambiguation(html):
            return None

        paragraphs = self._extract_paragraphs(html)
        normalized = [normalize_chunk(p, source="wiki") for p in paragraphs]
        substantive = [c for c in normalized if is_substantive(c)]
        if not substantive:
            return None

        text = "\n\n".join(cap_per_opening(substantive))
        return ProseChunk(source_url=url, license=self.license, text=text)

    @staticmethod
    def _is_disambiguation(html: str) -> bool:
        # Wikipedia disambiguation pages carry a stable marker class.
        return (
            'class="hatnote-list"' in html
            or "disambiguation" in html.lower()[:1500]
            and "may refer to" in html.lower()[:3000]
        )

    @staticmethod
    def _extract_paragraphs(html: str) -> list[str]:
        """Very light extraction: collect <p>...</p> blocks before the references."""
        # Cut after References / External links — those sections are usually noise.
        cutoffs = ('id="References"', 'id="External_links"', 'id="Notes"')
        cut_at = len(html)
        for marker in cutoffs:
            idx = html.find(marker)
            if idx != -1 and idx < cut_at:
                cut_at = idx
        body = html[:cut_at]
        return re.findall(r"<p[^>]*>(.*?)</p>", body, flags=re.DOTALL)
