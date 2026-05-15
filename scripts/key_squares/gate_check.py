"""Phase 2a → 2b unlock gate check (R9.1).

Counts reviewed-and-approved openings in ``scripts/curated/key_squares.yml``;
exits non-zero with an explicit message if the count is below the threshold.
Wired as a pre-merge check for any Phase 2b PR.

Usage::

    uv run python -m scripts.key_squares.gate_check
    # exit 0 → ≥30 openings approved; 2b may proceed
    # exit 1 → below threshold; 2b must wait
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CURATED_YML = REPO_ROOT / "scripts" / "curated" / "key_squares.yml"

DEFAULT_THRESHOLD = 30


def count_approved(path: Path) -> int:
    """Number of top-level opening entries in curated key_squares.yml."""
    if not path.exists():
        return 0
    raw = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(raw, dict):
        return 0
    # Only count entries that actually carry at least one square — an entry
    # with `squares: []` is not "approved" in the spec sense.
    return sum(1 for v in raw.values() if isinstance(v, dict) and v.get("squares"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--curated", type=Path, default=CURATED_YML, help="Path to curated/key_squares.yml"
    )
    parser.add_argument(
        "--threshold",
        type=int,
        default=DEFAULT_THRESHOLD,
        help=f"Minimum approved openings (default: {DEFAULT_THRESHOLD})",
    )
    args = parser.parse_args(argv)
    count = count_approved(args.curated)
    if count < args.threshold:
        print(
            f"GATE FAILED: {count}/{args.threshold} openings approved in "
            f"{args.curated}. Phase 2b UI work is blocked until threshold met "
            "(R9.1).",
            file=sys.stderr,
        )
        return 1
    print(
        f"GATE OK: {count}/{args.threshold} openings approved in {args.curated}."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
