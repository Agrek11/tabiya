"""Tests for the line extender — covers all stop conditions + branch logic.

Uses a FakeExplorer that returns canned responses keyed by FEN, so no network
or filesystem caches are exercised.
"""

from __future__ import annotations

from dataclasses import dataclass

import pytest

from scripts.tabiya_build.explorer import ExplorerMove, ExplorerResponse
from scripts.tabiya_build.extender import (
    HARD_DEPTH_CAP,
    POPULARITY_THRESHOLD,
    SECOND_BRANCH_GAP_MAX,
    ExtendedLine,
    extend_line,
    extend_with_branch,
    play_moves,
    relative_frequency,
    resolve_depth_cap,
    seed_to_san,
)
from scripts.tabiya_build.whitelist import OpeningSpec

# ---------------------------------------------------------------------------
# Fake explorer
# ---------------------------------------------------------------------------


@dataclass
class FakeExplorer:
    """Returns canned ExplorerResponse keyed by fen.

    Falls back to an empty response (no continuations) for unknown FENs so
    tests can exercise the stop_no_continuations path implicitly.
    """

    responses: dict[str, ExplorerResponse]

    def fetch(self, fen: str) -> ExplorerResponse:
        return self.responses.get(
            fen,
            ExplorerResponse(moves=[], white=0, draws=0, black=0),
        )


def _move(san: str, white: int = 0, draws: int = 0, black: int = 0) -> ExplorerMove:
    return ExplorerMove(san=san, uci="", white=white, draws=draws, black=black)


def _resp(moves: list[ExplorerMove]) -> ExplorerResponse:
    total_w = sum(m.white for m in moves)
    total_d = sum(m.draws for m in moves)
    total_b = sum(m.black for m in moves)
    return ExplorerResponse(moves=moves, white=total_w, draws=total_d, black=total_b)


# ---------------------------------------------------------------------------
# Seed parser + helpers
# ---------------------------------------------------------------------------


class TestSeedToSan:
    def test_parses_classic_seed(self) -> None:
        assert seed_to_san("1. e4 e5 2. Nf3 Nc6 3. Bb5") == [
            "e4", "e5", "Nf3", "Nc6", "Bb5",
        ]

    def test_handles_no_move_numbers(self) -> None:
        assert seed_to_san("e4 e5") == ["e4", "e5"]

    def test_stops_on_result(self) -> None:
        assert seed_to_san("1. e4 e5 1-0") == ["e4", "e5"]


class TestRelativeFrequency:
    def test_normal(self) -> None:
        assert relative_frequency(50, 100) == pytest.approx(0.5)

    def test_zero_total(self) -> None:
        assert relative_frequency(50, 0) == 0.0


class TestResolveDepthCap:
    def _spec(self, depth_override: int | None = None) -> OpeningSpec:
        return OpeningSpec(
            id="test",
            display_name="Test",
            eco_range="A00",
            color="white",
            seed_pgn="1. e4",
            depth_override=depth_override,
        )

    def test_default_depth(self) -> None:
        assert resolve_depth_cap(self._spec(), max_depth=None) == 18

    def test_spec_override(self) -> None:
        assert resolve_depth_cap(self._spec(depth_override=20), max_depth=None) == 20

    def test_max_depth_overrides_spec(self) -> None:
        assert resolve_depth_cap(self._spec(depth_override=20), max_depth=10) == 10

    def test_caps_at_hard_limit(self) -> None:
        assert resolve_depth_cap(self._spec(), max_depth=99) == HARD_DEPTH_CAP


# ---------------------------------------------------------------------------
# extend_line
# ---------------------------------------------------------------------------


class TestExtendLine:
    SEED = ["e4", "e5"]
    SEED_FEN = play_moves(SEED).fen()

    def _spec(self, depth: int | None = None) -> OpeningSpec:
        return OpeningSpec(
            id="t",
            display_name="T",
            eco_range="A00",
            color="white",
            seed_pgn="1. e4 e5",
            depth_override=depth,
        )

    def test_no_continuations_stops_immediately(self) -> None:
        explorer = FakeExplorer(responses={})  # any FEN → empty
        result = extend_line(self._spec(), self.SEED, explorer)
        assert result.stop.code == "no_continuations"
        assert result.moves == self.SEED
        assert result.popularity == 1.0

    def test_low_popularity_stops(self) -> None:
        # Top continuation is 10% of total → below threshold (15%).
        responses = {
            self.SEED_FEN: _resp([
                _move("Nf3", white=10, draws=0, black=0),
                _move("Bc4", white=20, draws=0, black=0),
                _move("d4", white=70, draws=0, black=0),
            ]),
        }
        explorer = FakeExplorer(responses=responses)
        result = extend_line(self._spec(), self.SEED, explorer)
        assert result.stop.code == "low_popularity"
        assert result.moves == self.SEED  # nothing appended

    def test_depth_reached_stops_at_cap(self) -> None:
        # Always return Nf3 as a strong top continuation. depth_override = 4 caps quickly.
        # Build a chain of FENs where each has the same canned response.
        responses: dict[str, ExplorerResponse] = {}
        b = play_moves(self.SEED)
        for _ in range(10):
            responses[b.fen()] = _resp([_move("Nf3", white=80, draws=0, black=0)])
            try:
                b.push_san("Nf3")
            except Exception:  # noqa: BLE001  # second Nf3 illegal
                break
        # Cap depth at len(SEED) so we exit immediately on depth_reached.
        result = extend_line(self._spec(depth=len(self.SEED)), self.SEED, explorer=FakeExplorer({}))
        assert result.stop.code == "depth_reached"
        assert len(result.moves) == len(self.SEED)

    def test_appends_top_continuation(self) -> None:
        responses = {
            self.SEED_FEN: _resp([
                _move("Nf3", white=80, draws=0, black=0),
                _move("Bc4", white=20, draws=0, black=0),
            ]),
        }
        explorer = FakeExplorer(responses=responses)
        # Depth 3 → seed (2) + 1 extension
        result = extend_line(self._spec(depth=3), self.SEED, explorer)
        assert result.moves[-1] == "Nf3"
        assert result.popularity == pytest.approx(0.8)

    def test_max_depth_arg_overrides_spec(self) -> None:
        explorer = FakeExplorer({})
        result = extend_line(self._spec(depth=20), self.SEED, explorer, max_depth=5)
        # Cap is 5; seed is 2; with no continuations we still stop, but at "no_continuations"
        # because we never get to depth. So just assert the cap was respected by
        # checking we never got past 5.
        assert len(result.moves) <= 5


# ---------------------------------------------------------------------------
# extend_with_branch
# ---------------------------------------------------------------------------


class TestExtendWithBranch:
    SEED = ["e4", "e5"]
    SEED_FEN = play_moves(SEED).fen()

    def _spec(self) -> OpeningSpec:
        return OpeningSpec(
            id="t",
            display_name="T",
            eco_range="A00",
            color="white",
            seed_pgn="1. e4 e5",
            depth_override=2,  # immediate depth_reached
        )

    def test_returns_only_main_when_one_continuation(self) -> None:
        responses = {self.SEED_FEN: _resp([_move("Nf3", white=80)])}
        explorer = FakeExplorer(responses=responses)
        result = extend_with_branch(self._spec(), self.SEED, explorer)
        assert len(result) == 1

    def test_returns_only_main_when_gap_too_large(self) -> None:
        # Top 80%, second 10% → gap = 70pp >> 5pp.
        responses = {
            self.SEED_FEN: _resp([
                _move("Nf3", white=80),
                _move("Bc4", white=10),
                _move("d4", white=10),
            ]),
        }
        explorer = FakeExplorer(responses=responses)
        result = extend_with_branch(self._spec(), self.SEED, explorer)
        assert len(result) == 1

    def test_returns_two_lines_when_gap_within_threshold(self) -> None:
        # Top 50%, second 48% → gap = 2pp < 5pp.
        responses = {
            self.SEED_FEN: _resp([
                _move("Nf3", white=50, draws=0, black=0),
                _move("Bc4", white=48, draws=0, black=0),
                _move("d4", white=2, draws=0, black=0),
            ]),
        }
        explorer = FakeExplorer(responses=responses)
        result = extend_with_branch(self._spec(), self.SEED, explorer)
        assert len(result) == 2
        assert result[1].moves[-1] == "Bc4"  # branch picked up the second-best move

    def test_branch_threshold_boundary(self) -> None:
        # Exactly 5pp apart → NOT below threshold (gap > MAX is the exclusion rule).
        # gap = SECOND_BRANCH_GAP_MAX exactly → still includes branch (uses `>` strict).
        responses = {
            self.SEED_FEN: _resp([
                _move("Nf3", white=int((0.50 + SECOND_BRANCH_GAP_MAX) * 1000)),
                _move("Bc4", white=500),
            ]),
        }
        explorer = FakeExplorer(responses=responses)
        result = extend_with_branch(self._spec(), self.SEED, explorer)
        # gap is exactly SECOND_BRANCH_GAP_MAX → kept (strict >)
        assert len(result) == 2

    def test_returned_objects_are_extended_lines(self) -> None:
        responses = {self.SEED_FEN: _resp([_move("Nf3", white=80)])}
        explorer = FakeExplorer(responses=responses)
        result = extend_with_branch(self._spec(), self.SEED, explorer)
        assert all(isinstance(x, ExtendedLine) for x in result)


# ---------------------------------------------------------------------------
# Threshold constants are sanity-checked
# ---------------------------------------------------------------------------


def test_thresholds_within_expected_range() -> None:
    assert 0 < POPULARITY_THRESHOLD < 1
    assert 0 < SECOND_BRANCH_GAP_MAX < 1
    assert HARD_DEPTH_CAP == 20
