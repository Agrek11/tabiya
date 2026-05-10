"""Tests for build_catalog.build_families (Phase 0d.3)."""

from __future__ import annotations

from scripts.build_catalog import build_families
from scripts.tabiya_build.schema import Opening


def make_op(id_: str, family_id: str, *, is_gambit: bool = False) -> Opening:
    return Opening(
        id=id_,
        family_id=family_id,
        name=id_,
        eco="A00",
        color="white",
        line_ids=[],
        is_gambit=is_gambit,
    )


def test_groups_openings_by_family_id() -> None:
    openings = [
        make_op("ruy-lopez", "open-games"),
        make_op("italian-game", "open-games"),
        make_op("sicilian", "semi-open"),
    ]
    families = build_families(openings)
    by_id = {f.id: f for f in families}
    assert by_id["open-games"].opening_ids == ["ruy-lopez", "italian-game"]
    assert by_id["semi-open"].opening_ids == ["sicilian"]
    assert by_id["closed-games"].opening_ids == []


def test_gambit_cross_cuts_into_gambits_family() -> None:
    """Opening flagged is_gambit shows up under 'gambits' family in addition
    to its primary family — without being duplicated when its primary family
    is already 'gambits'."""
    openings = [
        make_op("kings-gambit", "open-games", is_gambit=True),
        make_op("evans-gambit", "gambits", is_gambit=True),
        make_op("italian-game", "open-games"),
    ]
    families = build_families(openings)
    by_id = {f.id: f for f in families}
    # primary lists
    assert "kings-gambit" in by_id["open-games"].opening_ids
    assert "italian-game" in by_id["open-games"].opening_ids
    # gambits cross-cut: contains both, but no duplicate of evans-gambit
    assert by_id["gambits"].opening_ids == ["evans-gambit", "kings-gambit"]


def test_unknown_family_id_warns_but_does_not_crash(caplog: object) -> None:
    """An opening pointing at a missing family is logged + skipped from any
    family bucket. Build must not crash."""
    openings = [make_op("rogue-opening", "phantom-family")]
    families = build_families(openings)
    # No family contains rogue-opening
    for f in families:
        assert "rogue-opening" not in f.opening_ids


def test_returns_all_target_families_in_order() -> None:
    """build_families should always emit every TARGET_FAMILIES entry, in seed
    order, even if some have zero openings."""
    families = build_families([])
    ids = [f.id for f in families]
    assert ids == [
        "open-games",
        "semi-open",
        "closed-games",
        "indian-defenses",
        "flank",
        "gambits",
        "uncategorized",
    ]
    assert all(f.opening_ids == [] for f in families)
