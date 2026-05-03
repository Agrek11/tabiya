"""Tests for slug + IdMinter."""

from __future__ import annotations

import pytest

from scripts.tabiya_build.slug import IdMinter, slugify


class TestSlugify:
    def test_simple(self) -> None:
        assert slugify("Ruy Lopez") == "ruy-lopez"

    def test_parentheses(self) -> None:
        assert slugify("Ruy Lopez (Closed)") == "ruy-lopez-closed"

    def test_apostrophe(self) -> None:
        assert slugify("King's Indian Defense") == "king-s-indian-defense"

    def test_collapses_runs(self) -> None:
        assert slugify("   --multi   --   spaces--   ") == "multi-spaces"

    def test_unicode_stripped(self) -> None:
        # No diacritic-handling — they collapse to dashes; that's fine for ECO names.
        assert slugify("Réti Opening") == "r-ti-opening"


class TestIdMinter:
    def test_first_request_returns_base(self) -> None:
        m = IdMinter()
        assert m.mint("foo") == "foo"

    def test_collision_appends_2(self) -> None:
        m = IdMinter()
        m.mint("foo")
        assert m.mint("foo") == "foo-2"

    def test_multi_collision(self) -> None:
        m = IdMinter()
        m.mint("foo")
        m.mint("foo")  # foo-2
        m.mint("foo")  # foo-3
        assert m.mint("foo") == "foo-4"

    def test_in_operator(self) -> None:
        m = IdMinter()
        m.mint("foo")
        assert "foo" in m
        assert "bar" not in m

    def test_reserve(self) -> None:
        m = IdMinter()
        m.reserve("legacy-id")
        assert m.mint("legacy-id") == "legacy-id-2"

    @pytest.mark.parametrize("base", ["a", "ab", "ruy-lopez", "x" * 50])
    def test_roundtrip_unique(self, base: str) -> None:
        m = IdMinter()
        ids = {m.mint(base) for _ in range(5)}
        assert len(ids) == 5
