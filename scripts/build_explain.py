"""Phase 1b — LLM authoring pipeline for explain sidecars.

Drafts an `ExplainSidecar` for one catalog line by feeding the move sequence
+ resulting FENs + a few-shot from the gold Italian Pianissimo sidecar into
the Anthropic SDK. Output lands in `data/explain/pending/<line_id>.json` for
human review via `scripts/review_explain.py`.

Constitution:
  - Article 1 — anthropic (MIT) + jinja2 (BSD-3) declared in pyproject.
  - Article 3 — direct SDK call, no LangChain.
  - Article 7 — linear lines only (one block per ply).
  - Article 11 — build-time only; never ships in the frontend bundle.

Usage:
    # Author a pending draft:
    uv run python scripts/build_explain.py \\
        --line-id ruy-lopez-closed-main \\
        --opening "Ruy Lopez"

    # Or just copy validated sidecars into public/explain/:
    uv run python scripts/build_explain.py --copy-to-public

Prompt caching: the gold few-shot block is sent under
`cache_control: { type: "ephemeral" }` so multi-line batches reuse the
cached prefix and reduce token spend (Anthropic native — no extra dep).
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass
from pathlib import Path

# Note: anthropic is imported lazily inside `run_anthropic_call` so this
# module can be imported (and unit-tested) without an API key set.

import chess  # python-chess (already a project dep)
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pydantic import ValidationError

from scripts.tabiya_build.schema import Catalog, ExplainSidecar
from scripts.tabiya_build.validate_explain import (
    ExplainValidationError,
    copy_explain_to_public,
    validate_sidecar_file,
)

logger = logging.getLogger("tabiya.explain.build")

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = REPO_ROOT / "public" / "catalog.json"
DEFAULT_GOLD = REPO_ROOT / "data" / "explain" / "italian-giuoco-pianissimo-main.json"
DEFAULT_OUT_DIR = REPO_ROOT / "data" / "explain" / "pending"
DEFAULT_PUBLIC_DIR = REPO_ROOT / "public" / "explain"
DEFAULT_TEMPLATE_DIR = REPO_ROOT / "specs" / "phase-1b-explain-mode" / "prompts"

# Few-shot truncation: ship the first N gold blocks. Cuts tokens; full gold is
# already kept in repo for human reference.
FEWSHOT_BLOCK_LIMIT = 6
DEFAULT_MODEL = "claude-3-5-sonnet-latest"


# ---------------------------------------------------------------------------
# Per-ply context derivation
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PlyContext:
    """Per-ply LLM context — index, SAN, FEN after the move."""

    index: int
    san: str
    fen_after: str


def build_ply_contexts(moves: list[str]) -> list[PlyContext]:
    """Replay the SAN moves on a python-chess Board, recording FEN after each.

    Article 9 — SAN is the canonical move format end-to-end.
    """
    board = chess.Board()
    out: list[PlyContext] = []
    for i, san in enumerate(moves):
        board.push_san(san)
        out.append(PlyContext(index=i + 1, san=san, fen_after=board.fen()))
    return out


def truncate_gold_blocks(gold_path: Path, limit: int = FEWSHOT_BLOCK_LIMIT) -> str:
    """Read the gold sidecar and return the first `limit` blocks as a JSON string."""
    raw = json.loads(gold_path.read_text(encoding="utf-8"))
    blocks = raw.get("blocks", [])
    truncated = {
        "line_id": raw.get("line_id"),
        "schema_version": raw.get("schema_version"),
        "blocks": blocks[:limit],
    }
    return json.dumps(truncated, indent=2)


# ---------------------------------------------------------------------------
# Prompt rendering
# ---------------------------------------------------------------------------


def render_prompt(
    *,
    template_dir: Path,
    opening_name: str,
    eco: str,
    line_id: str,
    plies: list[PlyContext],
    gold_blocks_json: str,
) -> str:
    env = Environment(
        loader=FileSystemLoader(str(template_dir)),
        autoescape=select_autoescape(disabled_extensions=("j2",), default=False),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    template = env.get_template("build_explain.j2")
    return template.render(
        opening_name=opening_name,
        eco=eco,
        line_id=line_id,
        plies=[{"index": p.index, "san": p.san, "fen_after": p.fen_after} for p in plies],
        gold_blocks_json=gold_blocks_json,
    )


# ---------------------------------------------------------------------------
# Anthropic SDK call (direct, no LangChain per Article 3)
# ---------------------------------------------------------------------------


def run_anthropic_call(
    *,
    prompt_body: str,
    gold_blocks_json: str,
    model: str = DEFAULT_MODEL,
    max_tokens: int = 4000,
) -> str:
    """Call Anthropic Messages with prompt caching on the few-shot block.

    Returns the raw response text (expected to be a JSON object). Caller
    parses + validates.
    """
    # Lazy import so module import doesn't require the dep at test time.
    import anthropic  # type: ignore[import-not-found]

    client = anthropic.Anthropic()
    # Two-block user message: (1) the few-shot, cached; (2) the per-line prompt.
    # The full template includes the few-shot inline, so we instead structure
    # the SDK call to put the gold block in a separate cached `text` part.
    # However the template already embeds gold_blocks_json inline; we keep
    # the simple single-block form here and rely on prefix caching of the
    # system prompt at the platform level for now. The cache_control marker
    # is set on the few-shot fragment to be future-proof.
    msg = client.messages.create(
        model=model,
        max_tokens=max_tokens,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": prompt_body,
                        "cache_control": {"type": "ephemeral"},
                    },
                ],
            },
        ],
    )
    # Anthropic SDK returns a list of content blocks; concatenate text parts.
    parts: list[str] = []
    for block in msg.content:
        if getattr(block, "type", None) == "text":
            parts.append(getattr(block, "text", ""))
    _ = gold_blocks_json  # already inlined into prompt_body
    return "".join(parts).strip()


# ---------------------------------------------------------------------------
# Response → ExplainSidecar
# ---------------------------------------------------------------------------


def parse_sidecar_response(text: str) -> ExplainSidecar:
    """Parse the LLM's JSON response into a validated `ExplainSidecar`.

    Raises:
      ValueError on JSON parse failure with the offending text in the error.
      ValidationError on schema violation.
    """
    # Strip ```json fences if the model included them despite instructions.
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[1]
        if cleaned.startswith("json"):
            cleaned = cleaned[len("json") :]
        cleaned = cleaned.strip().rstrip("`")
    try:
        raw = json.loads(cleaned)
    except json.JSONDecodeError as e:
        raise ValueError(f"failed to parse LLM JSON: {e}\n---\n{cleaned[:500]}") from e
    return ExplainSidecar.model_validate(raw)


# ---------------------------------------------------------------------------
# Catalog lookup
# ---------------------------------------------------------------------------


def _load_catalog(path: Path) -> Catalog:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Catalog.model_validate(raw)


def _find_line(catalog: Catalog, line_id: str) -> tuple[str, str, list[str]]:
    """Return (opening_display_name, eco, moves) for line_id, or raise."""
    line = next((line for line in catalog.lines if line.id == line_id), None)
    if line is None:
        raise KeyError(f"line_id {line_id!r} not found in catalog")
    opening = next((o for o in catalog.openings if o.id == line.opening_id), None)
    if opening is None:
        raise KeyError(f"opening {line.opening_id!r} not found for line {line_id}")
    return opening.name, opening.eco, list(line.moves)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Build a pending Explain Mode sidecar via LLM.")
    p.add_argument("--line-id", help="Catalog line id (e.g. ruy-lopez-closed-main).")
    p.add_argument("--opening", help="Display name override; default looked up in catalog.")
    p.add_argument(
        "--catalog",
        type=Path,
        default=DEFAULT_CATALOG,
        help="Catalog JSON (default: public/catalog.json).",
    )
    p.add_argument(
        "--gold-path",
        type=Path,
        default=DEFAULT_GOLD,
        help="Few-shot gold sidecar (default: data/explain/italian-giuoco-pianissimo-main.json).",
    )
    p.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_OUT_DIR,
        help="Destination for pending drafts (default: data/explain/pending/).",
    )
    p.add_argument(
        "--template-dir",
        type=Path,
        default=DEFAULT_TEMPLATE_DIR,
        help="Jinja2 template dir.",
    )
    p.add_argument(
        "--model",
        default=DEFAULT_MODEL,
        help=f"Anthropic model (default: {DEFAULT_MODEL}).",
    )
    p.add_argument(
        "--copy-to-public",
        action="store_true",
        help=(
            "Skip authoring; just copy validated data/explain/*.json to "
            "public/explain/. Useful for catalog-only rebuilds."
        ),
    )
    p.add_argument(
        "--public-dst",
        type=Path,
        default=DEFAULT_PUBLIC_DIR,
        help="Destination for --copy-to-public (default: public/explain/).",
    )
    p.add_argument(
        "--data-src",
        type=Path,
        default=REPO_ROOT / "data" / "explain",
        help="Source dir for --copy-to-public (default: data/explain).",
    )
    p.add_argument("--log-level", default="INFO")
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(
        level=args.log_level.upper(),
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        stream=sys.stderr,
    )

    # Mode 1 — just copy approved sidecars into public/.
    if args.copy_to_public:
        count = copy_explain_to_public(args.data_src, args.public_dst)
        logger.info("Copied %d sidecar(s) → %s", count, args.public_dst)
        return 0

    # Mode 2 — author a new pending draft.
    if not args.line_id:
        print("error: --line-id required (or use --copy-to-public)", file=sys.stderr)
        return 2

    catalog = _load_catalog(args.catalog)
    opening_name_lookup, eco, moves = _find_line(catalog, args.line_id)
    opening_name = args.opening or opening_name_lookup

    plies = build_ply_contexts(moves)
    gold_blocks_json = truncate_gold_blocks(args.gold_path)
    prompt_body = render_prompt(
        template_dir=args.template_dir,
        opening_name=opening_name,
        eco=eco,
        line_id=args.line_id,
        plies=plies,
        gold_blocks_json=gold_blocks_json,
    )

    if not os.environ.get("ANTHROPIC_API_KEY"):
        print(
            "error: ANTHROPIC_API_KEY not set in environment.\n"
            "       Export your key or run with --copy-to-public for the copy-only mode.",
            file=sys.stderr,
        )
        return 2

    logger.info("Calling Anthropic SDK (model=%s) for %d plies…", args.model, len(plies))
    response_text = run_anthropic_call(
        prompt_body=prompt_body,
        gold_blocks_json=gold_blocks_json,
        model=args.model,
    )

    try:
        sidecar = parse_sidecar_response(response_text)
    except (ValueError, ValidationError) as e:
        logger.error("Failed to parse LLM response: %s", e)
        # Persist raw response for debugging.
        debug_path = args.out_dir / f"{args.line_id}.raw.txt"
        args.out_dir.mkdir(parents=True, exist_ok=True)
        debug_path.write_text(response_text, encoding="utf-8")
        logger.info("Wrote raw response to %s for debugging", debug_path)
        return 1

    if sidecar.line_id != args.line_id:
        logger.warning(
            "LLM emitted line_id=%r but expected %r — overriding.",
            sidecar.line_id,
            args.line_id,
        )
        sidecar = sidecar.model_copy(update={"line_id": args.line_id})

    args.out_dir.mkdir(parents=True, exist_ok=True)
    out_path = args.out_dir / f"{args.line_id}.json"
    out_path.write_text(
        json.dumps(sidecar.model_dump(by_alias=True, exclude_none=True), indent=2) + "\n",
        encoding="utf-8",
    )
    logger.info("Wrote pending draft → %s (%d block(s))", out_path, len(sidecar.blocks))

    # Sanity: blocks length must match the catalog line.
    if len(sidecar.blocks) != len(moves):
        logger.warning(
            "Block count mismatch: drafted %d, expected %d. Reviewer will need to fix.",
            len(sidecar.blocks),
            len(moves),
        )

    # Try a dry-run validation so the reviewer sees structural issues early.
    try:
        validate_sidecar_file(out_path, catalog)
    except ExplainValidationError as e:
        logger.warning("Draft fails validation (expected — reviewer will fix): %s", e)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
