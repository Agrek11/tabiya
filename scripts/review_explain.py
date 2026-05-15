"""Phase 1b — Human review CLI for LLM-drafted explain sidecars.

Walks each block in `data/explain/pending/<line_id>.json`, renders the board
position via `python-chess`'s `Board.unicode()`, shows the draft text, and
prompts the reviewer for accept / edit / reject / skip / quit-save.

Approved blocks are written back to `data/explain/<line_id>.json` and run
through the validator. The pending file is deleted only on full-clean
acceptance.

No new runtime deps — `python-chess` is already a project dependency.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

import chess
from pydantic import ValidationError

from scripts.tabiya_build.schema import Catalog, ExplainBlock, ExplainSidecar
from scripts.tabiya_build.validate_explain import (
    ExplainValidationError,
    validate_sidecar_file,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_CATALOG = REPO_ROOT / "public" / "catalog.json"
DEFAULT_PENDING = REPO_ROOT / "data" / "explain" / "pending"
DEFAULT_APPROVED = REPO_ROOT / "data" / "explain"


def _render_board(moves: list[str], up_to: int) -> str:
    """Return a unicode rendering of the board after `up_to` plies played."""
    board = chess.Board()
    for san in moves[:up_to]:
        board.push_san(san)
    return board.unicode(borders=True)


def _edit_block(block: ExplainBlock) -> ExplainBlock:
    """Open $EDITOR on the block's JSON. Re-validate on close. Returns updated block."""
    editor = os.environ.get("EDITOR", "vi")
    raw = json.dumps(block.model_dump(by_alias=True, exclude_none=True), indent=2)
    with tempfile.NamedTemporaryFile(
        mode="w+",
        suffix=".json",
        delete=False,
        encoding="utf-8",
    ) as f:
        f.write(raw)
        tmp_path = Path(f.name)
    try:
        subprocess.run([editor, str(tmp_path)], check=False)  # noqa: S603 — user-driven CLI
        edited = tmp_path.read_text(encoding="utf-8")
        try:
            data = json.loads(edited)
            return ExplainBlock.model_validate(data)
        except (json.JSONDecodeError, ValidationError) as e:
            print(f"  ! edit failed validation: {e}", file=sys.stderr)
            print("  block left UNCHANGED.")
            return block
    finally:
        tmp_path.unlink(missing_ok=True)


def _print_block(idx: int, total: int, moves: list[str], block: ExplainBlock) -> None:
    color = "White" if idx % 2 == 0 else "Black"
    san = moves[idx] if idx < len(moves) else "?"
    print()
    print(f"─── Ply {idx + 1}/{total} — {color}: {san} ".ljust(60, "─"))
    print()
    print(_render_board(moves, idx + 1))
    print()
    print("  Rationale:")
    print(f"    {block.rationale}")
    if block.arrows:
        arrows = ", ".join(
            f"{a.from_}->{a.to} ({a.color or 'green'})" for a in block.arrows
        )
        print(f"  Arrows:    {arrows}")
    if block.highlights:
        hls = ", ".join(f"{h.square} ({h.intent or 'default'})" for h in block.highlights)
        print(f"  Highlights: {hls}")
    if block.threats:
        print(f"  Threats:   {block.threats}")
    if block.pause_ms is not None:
        print(f"  Pause:     {block.pause_ms}ms")
    print()


def _load_catalog(path: Path) -> Catalog:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return Catalog.model_validate(raw)


def _load_pending(path: Path) -> ExplainSidecar:
    raw = json.loads(path.read_text(encoding="utf-8"))
    return ExplainSidecar.model_validate(raw)


def _save_pending(path: Path, sidecar: ExplainSidecar) -> None:
    path.write_text(
        json.dumps(sidecar.model_dump(by_alias=True, exclude_none=True), indent=2) + "\n",
        encoding="utf-8",
    )


def review_line(
    *,
    line_id: str,
    pending_dir: Path,
    approved_dir: Path,
    catalog_path: Path,
) -> int:
    pending_path = pending_dir / f"{line_id}.json"
    if not pending_path.exists():
        print(f"error: pending sidecar not found: {pending_path}", file=sys.stderr)
        return 2

    catalog = _load_catalog(catalog_path)
    line = next((line for line in catalog.lines if line.id == line_id), None)
    if line is None:
        print(f"error: line {line_id!r} not found in catalog", file=sys.stderr)
        return 2

    sidecar = _load_pending(pending_path)
    blocks = list(sidecar.blocks)
    accepted: list[bool] = [False] * len(blocks)

    i = 0
    while i < len(blocks):
        block = blocks[i]
        _print_block(i, len(blocks), list(line.moves), block)
        print("  [a]ccept  [e]dit  [r]eject  [s]kip-to-next  [q]uit-save")
        choice = input("> ").strip().lower()
        if choice == "a":
            accepted[i] = True
            i += 1
        elif choice == "e":
            blocks[i] = _edit_block(block)
            # Stay on this ply until accepted or skipped.
        elif choice == "r":
            accepted[i] = False
            print("  rejected — final save blocked until this is fixed.")
            i += 1
        elif choice == "s":
            i += 1
        elif choice == "q":
            print("  saving partial review back to pending and exiting.")
            sidecar = sidecar.model_copy(update={"blocks": blocks})
            _save_pending(pending_path, sidecar)
            return 0
        else:
            print("  unrecognised — try a/e/r/s/q.")

    sidecar = sidecar.model_copy(update={"blocks": blocks})

    if not all(accepted):
        # Save partial progress to pending; do not promote.
        _save_pending(pending_path, sidecar)
        print(
            f"  partial review: {sum(accepted)}/{len(blocks)} accepted. "
            f"pending file kept: {pending_path}",
        )
        return 0

    # All accepted — prompt to promote.
    print()
    confirm = input(f"Move to {approved_dir / f'{line_id}.json'} and validate? [y/N] ").strip().lower()
    if confirm != "y":
        _save_pending(pending_path, sidecar)
        print("aborted; pending file kept.")
        return 0

    target = approved_dir / f"{line_id}.json"
    approved_dir.mkdir(parents=True, exist_ok=True)
    _save_pending(target, sidecar)
    try:
        validate_sidecar_file(target, catalog)
    except ExplainValidationError as e:
        print(f"  ! validation FAILED after promote: {e}", file=sys.stderr)
        # Roll back: leave target file in place (reviewer can inspect), keep pending.
        return 1

    pending_path.unlink(missing_ok=True)
    print(f"  ✓ approved → {target}")
    print("  ↳ run `uv run python scripts/build_explain.py --copy-to-public` to publish.")
    return 0


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Review Phase 1b explain sidecar drafts.")
    p.add_argument("--line", required=True, help="Line id to review.")
    p.add_argument("--pending-dir", type=Path, default=DEFAULT_PENDING)
    p.add_argument("--approved-dir", type=Path, default=DEFAULT_APPROVED)
    p.add_argument("--catalog", type=Path, default=DEFAULT_CATALOG)
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    return review_line(
        line_id=args.line,
        pending_dir=args.pending_dir,
        approved_dir=args.approved_dir,
        catalog_path=args.catalog,
    )


if __name__ == "__main__":
    raise SystemExit(main())
