"""Prose normalization helpers — chunk + per-opening caps."""

from __future__ import annotations

from scripts.key_squares.lib.normalize import (
    PER_CHUNK_CAP,
    PER_OPENING_CAP,
    cap_per_opening,
    is_substantive,
    normalize_chunk,
    strip_html,
)


def test_strip_html_removes_tags_and_collapses_whitespace() -> None:
    html = "<p>Hello   <b>chess</b>\n\nworld.</p>"
    assert strip_html(html) == "Hello chess world."


def test_strip_html_drops_wiki_footnote_refs() -> None:
    html = "<p>Italian Game[1] is named after[2] some guy.</p>"
    assert strip_html(html) == "Italian Game is named after some guy."


def test_normalize_chunk_handles_wiki_markup() -> None:
    raw = "The '''Italian Game''' is opened with [[1.e4|e4]]. {{citation needed}} See also."
    out = normalize_chunk(raw, source="wiki")
    assert "{{" not in out
    assert "[[" not in out
    assert "Italian Game" in out
    assert "e4" in out


def test_normalize_chunk_truncates_at_per_chunk_cap() -> None:
    long_text = "x" * (PER_CHUNK_CAP * 2)
    out = normalize_chunk(long_text)
    # Truncation adds "…" suffix; length is at most cap+1
    assert len(out) <= PER_CHUNK_CAP + 2
    assert out.endswith("…")


def test_normalize_chunk_empty_input_returns_empty() -> None:
    assert normalize_chunk("") == ""


def test_is_substantive_drops_short() -> None:
    assert not is_substantive("brief caption")
    assert is_substantive("This is a longer paragraph that contains real chess prose.")


def test_cap_per_opening_oldest_first_wins() -> None:
    chunks = ["a" * 5000, "b" * 5000, "c" * 5000, "d" * 5000]
    out = cap_per_opening(chunks)
    total = sum(len(c) for c in out)
    assert total <= PER_OPENING_CAP + 1  # +1 allows the ellipsis on a trimmed chunk
    # First chunk should be present and intact
    assert out[0].startswith("a" * 100)
    # Fourth chunk should never make it
    assert all(not c.startswith("d") for c in out)


def test_cap_per_opening_truncates_last_included_chunk() -> None:
    chunks = ["a" * 8000, "b" * 8000]
    out = cap_per_opening(chunks)
    total_chars = sum(len(c.rstrip("…")) for c in out)
    assert total_chars <= PER_OPENING_CAP
