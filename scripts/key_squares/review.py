"""Manual review CLI for LLM-extracted key-square drafts.

Iterates ``data/key_squares/pending/*.yml`` one opening at a time. For each
opening: render the canonical FEN as a unicode board with the draft squares
highlighted (ANSI 256-color backgrounds per role), then prompt the reviewer
per-draft: ``[a]ccept / [e]dit / [r]eject / [s]kip / [q]uit``.

State persists in ``.review_state.json`` after every decision — quit + restart
resumes mid-opening.

Outputs:
  - Accepted drafts → appended to ``scripts/curated/key_squares.yml``
    (the ONLY artifact the catalog build consumes, R3.9).
  - Rejected drafts → ``data/key_squares/rejected/<slug>.yml`` with a
    reviewer note (free-text) for prompt-tuning history.
  - Skipped drafts → left in pending (no-op).

CLI::

    uv run python -m scripts.key_squares.review                  # interactive
    uv run python -m scripts.key_squares.review --dry-run        # smoke test
    uv run python -m scripts.key_squares.review --auto-accept    # non-interactive
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections.abc import Iterable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import yaml

from .extract import KeySquareDraft

logger = logging.getLogger("tabiya.key_squares.review")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
PENDING_DIR = REPO_ROOT / "data" / "key_squares" / "pending"
REJECTED_DIR = REPO_ROOT / "data" / "key_squares" / "rejected"
CURATED_YML = REPO_ROOT / "scripts" / "curated" / "key_squares.yml"
STATE_FILE = REPO_ROOT / "data" / "key_squares" / ".review_state.json"


# --- Decision model --------------------------------------------------------


@dataclass
class Decision:
    """One reviewer decision for one draft."""

    kind: Literal["accept", "reject", "skip"]
    draft: dict[str, Any]  # KeySquareDraft.model_dump()
    note: str = ""  # reject-only free-text note


@dataclass
class ReviewState:
    """Persisted between sessions in .review_state.json."""

    completed: list[str] = field(default_factory=list)
    partial: dict[str, list[dict[str, Any]]] = field(default_factory=dict)


def load_state(path: Path = STATE_FILE) -> ReviewState:
    if not path.exists():
        return ReviewState()
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        logger.warning("malformed %s — starting fresh", path)
        return ReviewState()
    return ReviewState(
        completed=list(raw.get("completed", [])),
        partial={k: list(v) for k, v in raw.get("partial", {}).items()},
    )


def save_state(state: ReviewState, path: Path = STATE_FILE) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {"completed": state.completed, "partial": state.partial}
    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    tmp.replace(path)


# --- Board rendering -------------------------------------------------------


# ANSI 256-color background codes for each role. Falls back to bracket markers
# when TERM doesn't advertise color (R3.3).
ROLE_BG_COLOR: dict[str, int] = {
    "outpost": 22,  # green
    "control": 27,  # blue
    "tension": 178,  # amber
    "weak": 196,  # red
}

ROLE_LABEL: dict[str, str] = {
    "outpost": "OUT",
    "control": "CTL",
    "tension": "TNS",
    "weak": "WEK",
}


def _supports_color() -> bool:
    """True if the terminal advertises 256-color support."""
    term = os.environ.get("TERM", "")
    if not term or term == "dumb":
        return False
    if not sys.stdout.isatty():
        return False
    return "256" in term or "color" in term or term in {"xterm", "screen", "tmux"}


def render_with_highlights(
    fen: str,
    drafts: Iterable[KeySquareDraft],
    *,
    use_color: bool | None = None,
) -> str:
    """Render the FEN as a unicode chess board with drafts overlaid.

    When the terminal supports 256-color, each highlighted square gets a
    role-colored background; otherwise marked squares are wrapped in
    ``[OUT]``, ``[CTL]``, ``[TNS]``, ``[WEK]`` brackets.
    """
    import chess

    if use_color is None:
        use_color = _supports_color()
    board = chess.Board(fen)
    overlay = {d.square: d for d in drafts}

    rows: list[str] = []
    for rank in range(8, 0, -1):
        row_pieces: list[str] = [f"{rank} "]
        for file_ in range(8):
            square_name = chr(ord("a") + file_) + str(rank)
            sq = chess.parse_square(square_name)
            piece = board.piece_at(sq)
            glyph = piece.unicode_symbol() if piece else "·"
            cell = f" {glyph} "
            draft = overlay.get(square_name)
            if draft:
                if use_color:
                    bg = ROLE_BG_COLOR[draft.role]
                    cell = f"\033[48;5;{bg}m{cell}\033[0m"
                else:
                    label = ROLE_LABEL[draft.role]
                    cell = f"[{label}{glyph}]"
            row_pieces.append(cell)
        rows.append("".join(row_pieces))
    rows.append("   a  b  c  d  e  f  g  h")
    return "\n".join(rows)


# --- Pending I/O -----------------------------------------------------------


def load_pending(path: Path) -> dict[str, Any]:
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def list_pending(pending_dir: Path = PENDING_DIR) -> list[Path]:
    return sorted(pending_dir.glob("*.yml"))


# --- Edit flow -------------------------------------------------------------


def edit_inline(draft: KeySquareDraft, input_fn: Any = input) -> KeySquareDraft:
    """Interactive per-field edit. Default = current value (enter accepts).

    Validates via Pydantic; re-prompts on invalid input.
    """
    while True:
        square = input_fn(f"  square [{draft.square}]: ") or draft.square
        role = input_fn(f"  role [{draft.role}]: ") or draft.role
        for_color = input_fn(f"  for_color [{draft.for_color}]: ") or draft.for_color
        rationale = input_fn(f"  rationale [{draft.rationale}]: ") or draft.rationale
        source_url = input_fn(f"  source_url [{draft.source_url}]: ") or draft.source_url
        try:
            return KeySquareDraft.model_validate(
                {
                    "square": square,
                    "role": role,
                    "for_color": for_color,
                    "rationale": rationale,
                    "source_url": source_url,
                }
            )
        except Exception as e:
            print(f"  invalid edit: {e}\n  retry:")


# --- Commit ----------------------------------------------------------------


def _load_curated(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    return raw or {}


def _write_curated(curated: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(".yml.tmp")
    tmp.write_text(
        yaml.safe_dump(curated, sort_keys=True, allow_unicode=True),
        encoding="utf-8",
    )
    tmp.replace(path)


def commit_decisions(
    record: dict[str, Any],
    decisions: list[Decision],
    *,
    curated_path: Path = CURATED_YML,
    rejected_dir: Path = REJECTED_DIR,
) -> None:
    """Apply decisions: append accepts to curated.yml, write rejects, ignore skips."""
    slug = record["opening_slug"]

    accepts = [d for d in decisions if d.kind == "accept"]
    rejects = [d for d in decisions if d.kind == "reject"]

    if accepts:
        curated = _load_curated(curated_path)
        entry = curated.get(slug) or {
            "fen_canonical": record.get("fen_canonical", ""),
            "squares": [],
        }
        # De-dup on (square, role, for_color) tuple — re-running review never
        # silently doubles entries.
        existing_keys = {(s["square"], s["role"], s["for_color"]) for s in entry.get("squares", [])}
        for d in accepts:
            key = (d.draft["square"], d.draft["role"], d.draft["for_color"])
            if key in existing_keys:
                continue
            entry["squares"].append(d.draft)
            existing_keys.add(key)
        curated[slug] = entry
        _write_curated(curated, curated_path)

    if rejects:
        rejected_dir.mkdir(parents=True, exist_ok=True)
        rejected_path = rejected_dir / f"{slug}.yml"
        existing = (
            yaml.safe_load(rejected_path.read_text(encoding="utf-8")) or {}
            if rejected_path.exists()
            else {}
        )
        entries: list[dict[str, Any]] = list(existing.get("rejected", []))
        for d in rejects:
            entries.append({**d.draft, "reviewer_note": d.note})
        rejected_path.write_text(
            yaml.safe_dump({"rejected": entries}, sort_keys=False, allow_unicode=True),
            encoding="utf-8",
        )


# --- Review loop -----------------------------------------------------------


def _prompt_action(input_fn: Any, draft: KeySquareDraft) -> str:
    print(f"  Draft: {draft.square} {draft.role} for_color={draft.for_color}")
    print(f"    {draft.rationale}")
    print(f"    source: {draft.source_url}")
    return input_fn("  [a]ccept / [e]dit / [r]eject / [s]kip / [q]uit: ").strip().lower() or "s"


def review_one(
    path: Path,
    state: ReviewState,
    *,
    input_fn: Any = input,
    auto_accept: bool = False,
    dry_run: bool = False,
    curated_path: Path = CURATED_YML,
    rejected_dir: Path = REJECTED_DIR,
    state_path: Path = STATE_FILE,
) -> bool:
    """Review one pending file. Returns False if reviewer quit (resume later)."""
    record = load_pending(path)
    drafts = [KeySquareDraft.model_validate(d) for d in record.get("drafts", [])]
    decisions = [
        Decision(
            kind=d["kind"],
            draft=d["draft"],
            note=d.get("note", ""),
        )
        for d in state.partial.get(str(path), [])
    ]

    print(f"\n== {record['opening_slug']} — {record.get('opening_name', '')} ==")
    print(render_with_highlights(record.get("fen_canonical", ""), drafts))
    print()

    for i, draft in enumerate(drafts):
        if i < len(decisions):
            continue  # resume past completed decisions
        if auto_accept:
            decisions.append(Decision(kind="accept", draft=draft.model_dump()))
        else:
            action = _prompt_action(input_fn, draft)
            match action:
                case "a":
                    decisions.append(Decision(kind="accept", draft=draft.model_dump()))
                case "e":
                    edited = edit_inline(draft, input_fn=input_fn)
                    decisions.append(Decision(kind="accept", draft=edited.model_dump()))
                case "r":
                    note = input_fn("  note: ")
                    decisions.append(Decision(kind="reject", draft=draft.model_dump(), note=note))
                case "s":
                    decisions.append(Decision(kind="skip", draft=draft.model_dump()))
                case "q":
                    state.partial[str(path)] = [
                        {"kind": d.kind, "draft": d.draft, "note": d.note} for d in decisions
                    ]
                    save_state(state, state_path)
                    return False
                case _:
                    print(f"  ?? unknown action {action!r}, treating as skip")
                    decisions.append(Decision(kind="skip", draft=draft.model_dump()))
        # Persist after every decision (resumability)
        state.partial[str(path)] = [
            {"kind": d.kind, "draft": d.draft, "note": d.note} for d in decisions
        ]
        save_state(state, state_path)

    if not dry_run:
        commit_decisions(record, decisions, curated_path=curated_path, rejected_dir=rejected_dir)
    state.completed.append(str(path))
    state.partial.pop(str(path), None)
    save_state(state, state_path)
    return True


def main(
    *,
    pending_dir: Path = PENDING_DIR,
    curated_path: Path = CURATED_YML,
    rejected_dir: Path = REJECTED_DIR,
    state_path: Path = STATE_FILE,
    auto_accept: bool = False,
    dry_run: bool = False,
    input_fn: Any = input,
) -> int:
    """Drive the review loop across all pending files."""
    state = load_state(state_path)
    for path in list_pending(pending_dir):
        if str(path) in state.completed:
            continue
        cont = review_one(
            path,
            state,
            input_fn=input_fn,
            auto_accept=auto_accept,
            dry_run=dry_run,
            curated_path=curated_path,
            rejected_dir=rejected_dir,
            state_path=state_path,
        )
        if not cont:
            return 0
    return 0


def _cli_main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--auto-accept",
        action="store_true",
        help="Auto-accept every draft (smoke test only; never use for real review)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Render boards + prompt, but skip writing curated/rejected outputs",
    )
    args = parser.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    return main(auto_accept=args.auto_accept, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(_cli_main(sys.argv[1:]))
