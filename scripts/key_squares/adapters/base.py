"""SourceAdapter Protocol + ProseChunk model.

Adapter contract is the only seam between the scrape driver and source-specific
code. Adding a new source = one new file + one whitelist entry in
``scripts/key_squares/sources.yml``.

Constitution: Article 1 (only permissive sources land in the curated artifact;
the driver filters using PERMISSIVE_SPDX); Article 14 (Pydantic + type hints).
"""

from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field

# SPDX allowlist consumed by the scrape driver. Anything outside this set is
# skipped + logged, never written to the scraped record. Curated YAML never
# carries non-permissive source_urls because of the build-time license_audit
# step (see scripts/tabiya_build/key_squares.py).
PERMISSIVE_SPDX: frozenset[str] = frozenset(
    {
        "CC-BY-SA-4.0",
        "CC-BY-SA-3.0",
        "CC-BY-4.0",
        "CC-BY-3.0",
        "CC0-1.0",
        "ODbL-1.0",
        "MIT",
        "Apache-2.0",
        "BSD-3-Clause",
        "PD-Public-Domain",
    }
)


class ProseChunk(BaseModel):
    """One block of normalized prose from a scrape source.

    Stored verbatim (after normalization) in the scraped JSON record; carried
    through to the LLM extractor as raw context. The ``license`` field MUST
    be in :data:`PERMISSIVE_SPDX` or the driver will drop the chunk.
    """

    source_url: str = Field(..., description="Origin URL; appears verbatim in citations")
    license: str = Field(..., description="SPDX identifier, e.g. 'CC-BY-SA-4.0'")
    text: str = Field(..., description="Plain text, markup stripped, length-bounded")


class SourceAdapter(Protocol):
    """Per-source adapter contract.

    Adapters are pure: they discover candidate URLs and fetch prose. Robots
    check and rate limiting live in the driver (``scrape.py``), not the adapter,
    so a misbehaving adapter cannot bypass them.
    """

    name: str
    """Matches the ``id`` field in ``sources.yml``."""

    license: str
    """SPDX string declared in ``sources.yml`` for this source."""

    base_url: str
    """Host root, e.g. ``https://en.wikipedia.org``."""

    def discover(self, opening_slug: str, opening_name: str) -> list[str]:
        """Return candidate URLs for this opening on this source.

        Empty list = no entries here (not an error). Driver iterates each URL,
        applying robots check + rate limit before calling :meth:`fetch`.
        """
        ...

    def fetch(self, url: str) -> ProseChunk | None:
        """Fetch + normalize prose at the URL.

        Returns ``None`` on 404, on parsing failures, or when the source page
        does not actually contain opening prose (e.g. Wikipedia disambiguation
        pages). Network errors propagate; the driver decides retry policy.
        """
        ...
