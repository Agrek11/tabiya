"""Review CLI tests (stub stdin)."""

from __future__ import annotations

from pathlib import Path

import yaml

from scripts.key_squares.extract import KeySquareDraft
from scripts.key_squares.review import (
    ReviewState,
    edit_inline,
    load_state,
    render_with_highlights,
    review_one,
    save_state,
)


def _draft(**overrides) -> dict:
    base = {
        "square": "d5",
        "role": "control",
        "for_color": "white",
        "rationale": "central pivot",
        "source_url": "https://en.wikipedia.org/wiki/Italian_Game",
    }
    base.update(overrides)
    return base


def _pending(tmp_path: Path, drafts: list[dict]) -> Path:
    pending_dir = tmp_path / "pending"
    pending_dir.mkdir()
    path = pending_dir / "italian-game-main.yml"
    path.write_text(
        yaml.safe_dump(
            {
                "opening_slug": "italian-game-main",
                "opening_name": "Italian Game",
                "fen_canonical": (
                    "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"
                ),
                "extracted_at": "2026-05-15T00:00:00Z",
                "drafts": drafts,
            }
        ),
        encoding="utf-8",
    )
    return path


def test_render_with_highlights_plain_ascii_mode() -> None:
    fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"
    drafts = [KeySquareDraft.model_validate(_draft(square="f7", role="weak", for_color="black"))]
    out = render_with_highlights(fen, drafts, use_color=False)
    assert "[WEK" in out
    # rank labels on the left
    assert out.startswith("8 ") or "\n8 " in out or out.startswith("8 ")
    # file labels at the bottom
    assert "a  b  c  d  e  f  g  h" in out


def test_render_with_highlights_color_mode_wraps_with_ansi() -> None:
    fen = "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3"
    drafts = [KeySquareDraft.model_validate(_draft(square="d5"))]
    out = render_with_highlights(fen, drafts, use_color=True)
    assert "\033[48;5;" in out


def test_review_one_auto_accept_writes_curated(tmp_path: Path) -> None:
    pending = _pending(tmp_path, [_draft(), _draft(square="f7", role="weak", for_color="black")])
    state = ReviewState()
    curated = tmp_path / "key_squares.yml"
    rejected_dir = tmp_path / "rejected"
    state_path = tmp_path / ".review_state.json"

    ok = review_one(
        pending,
        state,
        auto_accept=True,
        curated_path=curated,
        rejected_dir=rejected_dir,
        state_path=state_path,
    )
    assert ok
    body = yaml.safe_load(curated.read_text(encoding="utf-8"))
    assert "italian-game-main" in body
    assert len(body["italian-game-main"]["squares"]) == 2
    assert str(pending) in state.completed


def test_review_one_reject_with_stub_stdin(tmp_path: Path) -> None:
    pending = _pending(tmp_path, [_draft(square="f7", role="weak", for_color="black")])
    state = ReviewState()
    curated = tmp_path / "key_squares.yml"
    rejected_dir = tmp_path / "rejected"
    state_path = tmp_path / ".review_state.json"

    inputs = iter(["r", "hallucinated"])
    review_one(
        pending,
        state,
        input_fn=lambda _prompt: next(inputs),
        curated_path=curated,
        rejected_dir=rejected_dir,
        state_path=state_path,
    )
    assert not curated.exists()  # no accepts → no curated write
    rejected = rejected_dir / "italian-game-main.yml"
    assert rejected.exists()
    body = yaml.safe_load(rejected.read_text(encoding="utf-8"))
    assert body["rejected"][0]["reviewer_note"] == "hallucinated"


def test_review_one_quit_preserves_partial_state(tmp_path: Path) -> None:
    pending = _pending(
        tmp_path,
        [
            _draft(square="d5"),
            _draft(square="f7", role="weak", for_color="black"),
        ],
    )
    state = ReviewState()
    curated = tmp_path / "key_squares.yml"
    rejected_dir = tmp_path / "rejected"
    state_path = tmp_path / ".review_state.json"

    inputs = iter(["a", "q"])
    cont = review_one(
        pending,
        state,
        input_fn=lambda _prompt: next(inputs),
        curated_path=curated,
        rejected_dir=rejected_dir,
        state_path=state_path,
    )
    assert cont is False
    # State file persisted with partial progress
    reloaded = load_state(state_path)
    assert str(pending) in reloaded.partial
    assert len(reloaded.partial[str(pending)]) == 1  # first accept only


def test_review_resumes_from_partial_state(tmp_path: Path) -> None:
    pending = _pending(
        tmp_path,
        [
            _draft(square="d5"),
            _draft(square="f7", role="weak", for_color="black"),
        ],
    )
    state_path = tmp_path / ".review_state.json"
    state = ReviewState(
        partial={str(pending): [{"kind": "accept", "draft": _draft(square="d5"), "note": ""}]}
    )
    save_state(state, state_path)
    curated = tmp_path / "key_squares.yml"
    rejected_dir = tmp_path / "rejected"
    state = load_state(state_path)

    # Auto-accept the remaining draft (second one) — should complete the file
    review_one(
        pending,
        state,
        auto_accept=True,
        curated_path=curated,
        rejected_dir=rejected_dir,
        state_path=state_path,
    )
    body = yaml.safe_load(curated.read_text(encoding="utf-8"))
    # Both squares end up curated (one from partial state, one from this run)
    assert len(body["italian-game-main"]["squares"]) == 2


def test_edit_inline_validates_on_submit() -> None:
    draft = KeySquareDraft.model_validate(_draft())
    inputs = iter(
        [
            "z9",  # invalid square (rejected)
            "outpost",
            "white",
            "edited rationale",
            "https://en.wikipedia.org/wiki/Italian_Game",
            # retry — valid square
            "f5",
            "outpost",
            "white",
            "edited rationale",
            "https://en.wikipedia.org/wiki/Italian_Game",
        ]
    )
    edited = edit_inline(draft, input_fn=lambda _prompt: next(inputs))
    assert edited.square == "f5"
    assert edited.rationale == "edited rationale"
