"""Prose normalization helpers used by adapters + scrape driver.

Pre-LLM normalization: strip markup, collapse whitespace, drop tiny chunks
(figure captions / table cells), enforce per-chunk + per-opening caps.
Bounded prompt input keeps token spend predictable and reduces hallucination
surface.

Per design §2a.2:
  - per-chunk cap        : 4000 chars
  - per-opening cap      : 12000 chars total (oldest-first wins on overflow)
  - drop chunks <40 chars (captions, table cells, navigation noise)
"""

from __future__ import annotations

import re

# Per-chunk hard cap on prose text length.
PER_CHUNK_CAP = 4000

# Per-opening total cap across all chunks.
PER_OPENING_CAP = 12000

# Drop chunks shorter than this (caption / nav noise).
MIN_CHUNK_LEN = 40


_TAG_RE = re.compile(r"<[^>]+>")
_REF_RE = re.compile(r"\[\d+\]")  # Wikipedia footnote markers
_WS_RE = re.compile(r"\s+")


def strip_html(raw: str) -> str:
    """Remove HTML tags and collapse whitespace. Conservative — keeps text content."""
    no_tags = _TAG_RE.sub(" ", raw)
    no_refs = _REF_RE.sub("", no_tags)
    return _WS_RE.sub(" ", no_refs).strip()


def _strip_wikimarkup_inplace(text: str) -> str:
    """Lightweight wiki markup stripping when ``mwparserfromhell`` isn't available.

    Removes: [[link|display]] → display, [[link]] → link, '''bold''' → bold,
    ''italic'' → italic, {{templates}} → "", and HTML tags via strip_html.

    Wikipedia adapter prefers ``mwparserfromhell`` when available; this is a
    fallback so the pipeline doesn't depend on an optional pkg.
    """
    # Remove templates {{...}} including nested (greedy enough for short ones).
    prev = None
    out = text
    while prev != out:
        prev = out
        out = re.sub(r"\{\{[^{}]*\}\}", "", out)
    # Wiki tables — coarse stripping (drop entire {| ... |} blocks).
    out = re.sub(r"\{\|.*?\|\}", "", out, flags=re.DOTALL)
    # Internal links [[A|B]] → B, [[A]] → A
    out = re.sub(r"\[\[([^\]|]+)\|([^\]]+)\]\]", r"\2", out)
    out = re.sub(r"\[\[([^\]]+)\]\]", r"\1", out)
    # External links [url label] → label
    out = re.sub(r"\[https?://\S+\s+([^\]]+)\]", r"\1", out)
    # Bold / italic
    out = re.sub(r"'''([^']+)'''", r"\1", out)
    out = re.sub(r"''([^']+)''", r"\1", out)
    # HTML residue + whitespace
    return strip_html(out)


def normalize_chunk(raw_text: str, *, source: str | None = None) -> str:
    """Normalize one raw chunk of prose.

    - ``source`` (optional): "wiki" applies wiki-markup stripping first.
    - Always strips HTML and collapses whitespace.
    - Truncates to :data:`PER_CHUNK_CAP` characters.
    """
    if not raw_text:
        return ""
    if source == "wiki":
        text = _strip_wikimarkup_inplace(raw_text)
    else:
        text = strip_html(raw_text)
    if len(text) > PER_CHUNK_CAP:
        text = text[:PER_CHUNK_CAP].rstrip() + "…"
    return text


def cap_per_opening(chunks: list[str]) -> list[str]:
    """Apply the per-opening total-character cap. Oldest-first wins.

    Returns a new list. Truncates the last included chunk if it would otherwise
    push past the cap; later chunks are dropped entirely.
    """
    out: list[str] = []
    total = 0
    for chunk in chunks:
        if not chunk:
            continue
        if total >= PER_OPENING_CAP:
            break
        remaining = PER_OPENING_CAP - total
        if len(chunk) > remaining:
            out.append(chunk[:remaining].rstrip() + "…")
            total = PER_OPENING_CAP
            break
        out.append(chunk)
        total += len(chunk)
    return out


def is_substantive(chunk: str) -> bool:
    """True iff chunk passes the minimum-length heuristic (drops captions)."""
    return len(chunk.strip()) >= MIN_CHUNK_LEN
