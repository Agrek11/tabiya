"""Tests for the opening whitelist."""

from __future__ import annotations

import chess
from scripts.tabiya_build.whitelist import (
    DEFAULT_DEPTH,
    TARGET_FAMILIES,
    TARGET_OPENINGS,
    FamilySpec,
    OpeningSpec,
    filter_openings,
    get_family,
    get_opening,
)


def test_whitelist_size() -> None:
    # Req 2.1 — 15 to 20 openings
    assert 15 <= len(TARGET_OPENINGS) <= 20


def test_unique_ids() -> None:
    ids = [s.id for s in TARGET_OPENINGS]
    assert len(ids) == len(set(ids)), "opening ids must be unique"


def test_minimum_set_present() -> None:
    # Req 2.3 — minimum required openings
    must_have = {
        "ruy-lopez",
        "italian-game",
        "sicilian-defense",
        "french-defense",
        "caro-kann",
        "queens-gambit",
        "kings-indian",
        "nimzo-indian",
        "english-opening",
        "scandinavian",
        "london-system",
        "slav-defense",
        "pirc-defense",
        "vienna-game",
        "alekhine-defense",
    }
    actual = {s.id for s in TARGET_OPENINGS}
    missing = must_have - actual
    assert not missing, f"missing required openings: {missing}"


def test_seeds_parse_legally() -> None:
    """Every seed_pgn must be a sequence of legal SAN moves."""
    for spec in TARGET_OPENINGS:
        board = chess.Board()
        for tok in spec.seed_pgn.replace("\n", " ").split():
            if tok[0].isdigit() and "." in tok:
                continue
            if tok in {"1-0", "0-1", "1/2-1/2", "*"}:
                break
            try:
                move = board.parse_san(tok)
            except (ValueError, chess.IllegalMoveError, chess.AmbiguousMoveError) as e:
                raise AssertionError(
                    f"opening {spec.id!r} has illegal seed token {tok!r}: {e}"
                ) from e
            board.push(move)


def test_depth_overrides_in_band() -> None:
    """Depth overrides must be 16, 18, or 20 — within the 20-ply hard cap (Article 8)."""
    for spec in TARGET_OPENINGS:
        if spec.depth_override is not None:
            assert spec.depth_override in (16, 18, 20), (
                f"unexpected depth_override {spec.depth_override} on {spec.id}"
            )


def test_sharp_lines_capped_at_20() -> None:
    sharp_ids = {"sicilian-najdorf", "sicilian-dragon"}
    for sid in sharp_ids:
        spec = get_opening(sid)
        if spec is not None:
            assert spec.depth_override == 20, f"{sid} should be 20-ply"


def test_quiet_lines_capped_at_16() -> None:
    quiet_ids = {"london-system", "caro-kann"}
    for qid in quiet_ids:
        spec = get_opening(qid)
        if spec is not None:
            assert spec.depth_override == 16, f"{qid} should be 16-ply"


def test_default_depth_constant() -> None:
    assert DEFAULT_DEPTH == 18


class TestGetOpening:
    def test_existing(self) -> None:
        assert get_opening("ruy-lopez") is not None

    def test_missing(self) -> None:
        assert get_opening("does-not-exist") is None


class TestFilterOpenings:
    def test_none_returns_full_list(self) -> None:
        result = filter_openings(None)
        assert len(result) == len(TARGET_OPENINGS)

    def test_subset(self) -> None:
        result = filter_openings(["ruy-lopez", "italian-game"])
        assert len(result) == 2
        assert {s.id for s in result} == {"ruy-lopez", "italian-game"}

    def test_unknown_ids_filtered_out(self) -> None:
        result = filter_openings(["ruy-lopez", "does-not-exist"])
        assert len(result) == 1
        assert result[0].id == "ruy-lopez"


def test_all_openings_typed_correctly() -> None:
    for spec in TARGET_OPENINGS:
        assert isinstance(spec, OpeningSpec)
        assert spec.color in ("white", "black")
        assert spec.id  # non-empty
        assert spec.display_name
        assert spec.eco_range
        assert spec.seed_pgn


# ---------------------------------------------------------------------------
# Phase 0d.3 — Family layer
# ---------------------------------------------------------------------------


class TestFamilyLayer:
    def test_families_seeded(self) -> None:
        ids = {f.id for f in TARGET_FAMILIES}
        assert {
            "open-games",
            "semi-open",
            "closed-games",
            "indian-defenses",
            "flank",
            "gambits",
        } <= ids

    def test_family_spec_typed_correctly(self) -> None:
        for fam in TARGET_FAMILIES:
            assert isinstance(fam, FamilySpec)
            assert fam.id
            assert fam.display_name
            assert fam.category in (
                "open",
                "semi-open",
                "closed",
                "indian",
                "flank",
                "gambit",
                "uncategorized",
            )

    def test_every_opening_has_known_family_id(self) -> None:
        family_ids = {f.id for f in TARGET_FAMILIES}
        for spec in TARGET_OPENINGS:
            assert spec.family_id, f"opening {spec.id!r} has empty family_id"
            assert spec.family_id in family_ids, (
                f"opening {spec.id!r} references unknown family {spec.family_id!r}"
            )

    def test_get_family(self) -> None:
        assert get_family("open-games") is not None
        assert get_family("does-not-exist") is None

    def test_queens_gambit_classified_as_closed_not_gambit(self) -> None:
        """Queen's Gambit is named 'gambit' but the c4 pawn returns; chess
        convention places it under closed games. Gambits flag must be False."""
        spec = get_opening("queens-gambit")
        assert spec is not None
        assert spec.family_id == "closed-games"
        assert spec.is_gambit is False
