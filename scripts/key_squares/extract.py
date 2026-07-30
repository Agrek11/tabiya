"""LLM extraction of key-square drafts from scraped opening prose.

Uses the Anthropic SDK directly (Article 3 — no LangChain). One call per
opening; output is strict JSON validated by Pydantic. Invalid drafts are
dropped, not surfaced for review (R2.6).

Pipeline::

    scraped/<slug>.json  →  extract_for_opening()  →  pending/<slug>.yml

The pending YAML is regenerable — re-running extract.py overwrites it.
Once a reviewer accepts/rejects via review.py, decisions land in
``scripts/curated/key_squares.yml`` (the only artifact the catalog build
reads, per R3.9).

CLI::

    uv run python -m scripts.key_squares.extract \\
        --openings ruy-lopez-closed-main,italian-game-main
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal

import yaml
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger("tabiya.key_squares.extract")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCRAPED_DIR = REPO_ROOT / "data" / "key_squares" / "scraped"
PENDING_DIR = REPO_ROOT / "data" / "key_squares" / "pending"
FEW_SHOT_YML = Path(__file__).resolve().parent / "prompts" / "few_shot.yml"

# Anthropic model id is configurable so test runs / cost experiments can swap.
# CHOICE: default to a stable, low-cost model; reviewer can override via
# ANTHROPIC_MODEL env var.
DEFAULT_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-5")

KeySquareRole = Literal["outpost", "weak", "tension", "control"]
KeySquareColor = Literal["white", "black"]


class KeySquareDraft(BaseModel):
    """One extracted key-square draft awaiting human review."""

    square: str = Field(..., pattern=r"^[a-h][1-8]$")
    role: KeySquareRole
    for_color: KeySquareColor
    rationale: str = Field(..., max_length=280)
    source_url: str = Field(..., min_length=1)


class ExtractionResult(BaseModel):
    """Wrapper around the LLM's JSON output."""

    drafts: list[KeySquareDraft] = Field(default_factory=list)


SYSTEM_PROMPT = """\
You are a chess opening theorist annotating key squares for a training app.

Your job: read the source material for an opening and identify 0-6 KEY SQUARES
in the canonical position after the main line. A key square is one of:
- outpost  — a long-term piece anchor the opponent cannot easily contest
- control  — a central square whose occupation or contest decides the plan
- tension  — a square where opposing pawns/pieces interact at imbalance
- weak     — a square the defender cannot easily protect long-term

Rules (read carefully):
1. Output STRICT JSON only — no markdown, no commentary, no code fences.
2. The JSON object MUST have shape {"drafts": [...]} with zero or more entries.
3. Each draft MUST have: square (algebraic a1..h8), role (one of the four),
   for_color ("white"|"black"), rationale (≤280 chars, grounded in source
   material), source_url (cite the [Source: ...] URL your claim relies on).
4. If the source material does not support a clear key-square claim, return
   {"drafts": []}. NEVER fabricate squares; the human reviewer will catch
   hallucinations and reject the entire opening.
5. Prefer 2-4 high-confidence drafts over 6 speculative ones.
"""


@dataclass
class FewShotExemplar:
    """One few-shot exemplar loaded from prompts/few_shot.yml."""

    opening_slug: str
    opening_name: str
    fen_canonical: str
    prose: str
    output: list[KeySquareDraft]


def load_few_shot(path: Path = FEW_SHOT_YML) -> list[FewShotExemplar]:
    """Load + validate few-shot exemplars. Each ``output`` entry is Pydantic-validated."""
    raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
    exemplars: list[FewShotExemplar] = []
    for entry in raw.get("exemplars", []):
        output = [KeySquareDraft.model_validate(d) for d in entry.get("output", [])]
        exemplars.append(
            FewShotExemplar(
                opening_slug=entry["opening_slug"],
                opening_name=entry["opening_name"],
                fen_canonical=entry["fen_canonical"],
                prose=entry["prose"],
                output=output,
            )
        )
    return exemplars


def build_prompt(record: dict[str, Any], exemplars: Sequence[FewShotExemplar]) -> str:
    """Assemble the user prompt for one opening.

    Layout (matches design §2a.3):
        Opening: <name> (<slug>)
        Canonical FEN: <fen>
        Source material:
        ---
        [Source: <url>]
        <prose>
        ---
        Few-shot examples:
        <N exemplars rendered as input → output blocks>
        Task: identify 0-6 key squares ...
    """
    lines: list[str] = []
    lines.append(f"Opening: {record['opening_name']} ({record['opening_slug']})")
    lines.append(f"Canonical FEN: {record.get('fen_after_main_line', '<unknown>')}")
    lines.append("")
    lines.append("Source material:")
    lines.append("---")
    for chunk in record.get("prose_chunks", []):
        lines.append(f"[Source: {chunk['source_url']}]")
        lines.append(chunk["text"])
        lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("Few-shot examples:")
    for ex in exemplars:
        lines.append(f"Input — {ex.opening_name} ({ex.opening_slug})")
        lines.append(f"Prose: {ex.prose.strip()}")
        output_json = json.dumps({"drafts": [d.model_dump() for d in ex.output]}, indent=2)
        lines.append(f"Output:\n{output_json}")
        lines.append("")
    lines.append(
        "Task: identify 0-6 key squares for the position after the main line. "
        "For each: square, role (outpost|control|tension|weak), for_color, "
        "rationale (≤280 chars), source_url (cite a [Source: ...] URL from "
        'the source material). Output a single JSON object {"drafts": [...]}. '
        "No prose outside the JSON."
    )
    return "\n".join(lines)


def parse_json_from_text(text: str) -> dict[str, Any]:
    """Pull the first JSON object out of LLM response text.

    Defensive against models that wrap output in code fences despite the
    system prompt; raises :class:`json.JSONDecodeError` on no parse.
    """
    text = text.strip()
    # Strip markdown code fences if present
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    # Find the first balanced { ... } block
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not match:
        raise json.JSONDecodeError("no JSON object found", text, 0)
    return json.loads(match.group(0))


def extract_for_opening(
    record: dict[str, Any],
    client: Any,
    *,
    exemplars: Sequence[FewShotExemplar] | None = None,
    model: str = DEFAULT_MODEL,
    sleeper: Any = time.sleep,
) -> list[KeySquareDraft]:
    """Run the LLM extraction for one scraped opening record.

    Returns validated drafts (possibly empty). Retries up to 3 attempts on
    rate-limit / API status errors with exponential backoff (1, 2, 4 sec).
    Invalid drafts (Pydantic validation failure or JSON parse failure) drop
    silently per R2.6 — they never reach the pending review queue.
    """
    if exemplars is None:
        exemplars = load_few_shot()
    prompt = build_prompt(record, exemplars)

    # Local imports — keep the module importable even when anthropic isn't
    # installed for tests that don't exercise the SDK code path.
    import anthropic

    for attempt in range(3):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=2000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": prompt}],
            )
            # Anthropic SDK returns content as a list of blocks; the text
            # block is the first/only element for non-streaming calls.
            text = _response_text(resp)
            payload = parse_json_from_text(text)
            result = ExtractionResult.model_validate(payload)
            return result.drafts
        except (anthropic.RateLimitError, anthropic.APIStatusError) as e:
            wait = 2**attempt  # 1s, 2s, 4s
            logger.warning(
                "anthropic error on %s attempt %d: %s — retry in %ds",
                record.get("opening_slug"),
                attempt + 1,
                e,
                wait,
            )
            sleeper(wait)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(
                "%s: dropping all drafts — JSON/validation error: %s",
                record.get("opening_slug"),
                e,
            )
            return []
    logger.warning(
        "%s: extraction failed after 3 retries — returning empty drafts",
        record.get("opening_slug"),
    )
    return []


def _response_text(resp: Any) -> str:
    """Extract text from an Anthropic Message response.

    The SDK's Message type carries a list of TextBlock | ToolUseBlock; the
    first text block contains the JSON we asked for. This helper is centralized
    so test mocks can mimic the shape simply.
    """
    content = getattr(resp, "content", None)
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    # iterable of blocks
    for block in content:
        text = getattr(block, "text", None)
        if isinstance(text, str):
            return text
    return ""


def write_pending(
    record: dict[str, Any],
    drafts: list[KeySquareDraft],
    out_dir: Path = PENDING_DIR,
) -> Path:
    """Write the pending YAML per design §2a.3."""
    out_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "opening_slug": record["opening_slug"],
        "opening_name": record["opening_name"],
        "fen_canonical": record.get("fen_after_main_line", ""),
        "extracted_at": datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "drafts": [d.model_dump() for d in drafts],
    }
    path = out_dir / f"{record['opening_slug']}.yml"
    tmp = path.with_suffix(".yml.tmp")
    tmp.write_text(
        yaml.safe_dump(payload, sort_keys=False, allow_unicode=True),
        encoding="utf-8",
    )
    tmp.replace(path)
    return path


def main(
    opening_slugs: list[str] | None = None,
    *,
    scraped_dir: Path = SCRAPED_DIR,
    out_dir: Path = PENDING_DIR,
    client: Any | None = None,
) -> int:
    """Run extraction for the given slugs (or all scraped openings if None)."""
    if client is None:
        try:
            import anthropic
        except ImportError as e:
            logger.error("anthropic SDK not installed: %s", e)
            return 1
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            logger.error(
                "ANTHROPIC_API_KEY not set — set it in the environment, e.g."
                " `export ANTHROPIC_API_KEY=sk-ant-...` and re-run."
            )
            return 2
        client = anthropic.Anthropic(api_key=api_key)

    exemplars = load_few_shot()
    if not scraped_dir.exists():
        logger.error("scraped/ dir missing: %s — run scrape.py first", scraped_dir)
        return 1

    targets: list[Path]
    if opening_slugs:
        targets = [scraped_dir / f"{slug}.json" for slug in opening_slugs]
    else:
        targets = sorted(scraped_dir.glob("*.json"))

    for path in targets:
        if not path.exists():
            logger.warning("scraped file missing: %s", path)
            continue
        record = json.loads(path.read_text(encoding="utf-8"))
        logger.info("extracting: %s", record["opening_slug"])
        drafts = extract_for_opening(record, client, exemplars=exemplars)
        out = write_pending(record, drafts, out_dir)
        logger.info("wrote %d drafts → %s", len(drafts), out)
    return 0


def _cli_main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--openings",
        help="Comma-separated opening slugs to extract (default: all scraped)",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    slugs = args.openings.split(",") if args.openings else None
    return main(slugs)


if __name__ == "__main__":
    raise SystemExit(_cli_main(sys.argv[1:]))
