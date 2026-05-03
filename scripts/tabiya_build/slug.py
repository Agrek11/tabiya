"""Stable slug generation and collision-aware ID minter.

Constitution Article 6 — line IDs are stable forever. The IdMinter tracks all
emitted IDs in a single build run and appends `-2`, `-3`, etc. only when a base
slug actually collides. Existing slugs are NEVER renumbered.
"""

from __future__ import annotations

import re

_NON_ALNUM = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    """Lower-case, strip diacritics-free, collapse runs of non-alphanumerics to '-'.

    >>> slugify("Ruy Lopez (Closed)")
    'ruy-lopez-closed'
    >>> slugify("King's Indian Defense")
    'king-s-indian-defense'
    >>> slugify("   --multi   --   spaces--   ")
    'multi-spaces'
    """
    lowered = value.lower()
    dashed = _NON_ALNUM.sub("-", lowered)
    return dashed.strip("-")


class IdMinter:
    """Mints unique IDs from base slugs by appending numeric suffixes on collision.

    The first time a base is requested, it is returned as-is.
    Subsequent collisions are minted as `<base>-2`, `<base>-3`, etc.
    """

    def __init__(self) -> None:
        self._used: set[str] = set()

    def mint(self, base: str) -> str:
        """Return a unique slug, appending a numeric suffix on collision."""
        if base not in self._used:
            self._used.add(base)
            return base
        i = 2
        while f"{base}-{i}" in self._used:
            i += 1
        result = f"{base}-{i}"
        self._used.add(result)
        return result

    def reserve(self, slug: str) -> None:
        """Mark a pre-existing slug as used (for round-trip stability)."""
        self._used.add(slug)

    def __contains__(self, slug: str) -> bool:
        return slug in self._used
