"""Phase 1b — Explain sidecar validator.

Validates every `data/explain/*.json` file against the bundled `Catalog`.
Excludes `pending/` and `rejected/` subdirectories — those hold LLM drafts
in flight. A clean pass means every approved sidecar can be safely copied
to `public/explain/`.

Validation rules (R2 + design §2 "Validation gates"):

1. File parses as `ExplainSidecar`.
2. `sidecar.line_id` exists in the loaded catalog.
3. `len(sidecar.blocks) == len(line.moves)` — strict equality.
4. Every arrow `from`/`to` and every highlight `square` matches `^[a-h][1-8]$`.
   (Already enforced via pydantic patterns — this layer catches anything that
   somehow bypassed pydantic.)
5. `sidecar.schema_version == catalog.schema_version`.

Failures raise `ExplainValidationError` with structured message. The build
pipeline lifts that to fail loudly. Runtime never relies on this — it just
keeps malformed content out of `public/`.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from pydantic import ValidationError

from .schema import Catalog, ExplainSidecar

SQUARE_RE = re.compile(r"^[a-h][1-8]$")


class ExplainValidationError(Exception):
    """Raised when a sidecar fails build-time validation. Build fails loudly."""


def validate_sidecar_file(path: Path, catalog: Catalog) -> ExplainSidecar:
    """Validate one sidecar file against the catalog. Returns the parsed model.

    Args:
        path: Sidecar JSON file (must NOT be under pending/ or rejected/).
        catalog: Loaded Catalog the sidecar must align with.

    Raises:
        ExplainValidationError: with a structured message on any failure.
    """
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as e:
        raise ExplainValidationError(f"{path}: failed to read/parse JSON ({e})") from e

    try:
        sidecar = ExplainSidecar.model_validate(raw)
    except ValidationError as e:
        raise ExplainValidationError(f"{path}: schema validation failed:\n{e}") from e

    # 1. schema_version match (Catalog default = 2 in Phase 1b).
    if sidecar.schema_version != catalog.schema_version:
        raise ExplainValidationError(
            f"{path}: schema_version mismatch — sidecar={sidecar.schema_version}, "
            f"catalog={catalog.schema_version}. Re-author against the current catalog."
        )

    # 2. Look up the line.
    line = next((line for line in catalog.lines if line.id == sidecar.line_id), None)
    if line is None:
        raise ExplainValidationError(
            f"{path}: line_id {sidecar.line_id!r} not found in catalog. "
            f"Either the line was removed or the sidecar is stale."
        )

    # 3. Block count must match ply count (Article 7 — linear line).
    if len(sidecar.blocks) != len(line.moves):
        raise ExplainValidationError(
            f"{path}: blocks={len(sidecar.blocks)} but line.moves={len(line.moves)}. "
            f"Author one block per ply, exactly."
        )

    # 4. Belt-and-suspenders square-format check (pydantic patterns already
    #    enforce this; this layer catches anything weird).
    for i, block in enumerate(sidecar.blocks):
        for arrow in block.arrows or []:
            if not SQUARE_RE.match(arrow.from_) or not SQUARE_RE.match(arrow.to):
                raise ExplainValidationError(
                    f"{path}: block {i} has invalid arrow square(s): "
                    f"{arrow.from_!r}->{arrow.to!r}"
                )
        for hl in block.highlights or []:
            if not SQUARE_RE.match(hl.square):
                raise ExplainValidationError(
                    f"{path}: block {i} has invalid highlight square: {hl.square!r}"
                )

    return sidecar


def iter_sidecar_paths(data_dir: Path) -> list[Path]:
    """Return all approved sidecar JSON files under data_dir.

    Excludes any file whose path contains `pending/` or `rejected/`. Walks
    top-level only — sidecars live flat under data/explain/.
    """
    if not data_dir.exists():
        return []
    out: list[Path] = []
    for entry in sorted(data_dir.iterdir()):
        if entry.is_dir():
            continue
        if entry.suffix.lower() != ".json":
            continue
        out.append(entry)
    return out


def validate_all_explain_sidecars(data_dir: Path, catalog: Catalog) -> list[ExplainSidecar]:
    """Validate every sidecar under `data_dir` (top-level files only).

    Returns the list of parsed sidecars on full success. Raises on the FIRST
    failure (build pipeline aborts immediately).
    """
    sidecars: list[ExplainSidecar] = []
    for path in iter_sidecar_paths(data_dir):
        sidecars.append(validate_sidecar_file(path, catalog))
    return sidecars


def copy_explain_to_public(src: Path, dst: Path) -> int:
    """Copy validated sidecar JSON from src/*.json to dst/. Returns count.

    Skips pending/ and rejected/ subdirs. Overwrites existing files in dst.
    """
    if not src.exists():
        return 0
    dst.mkdir(parents=True, exist_ok=True)
    count = 0
    for path in iter_sidecar_paths(src):
        target = dst / path.name
        target.write_text(path.read_text(encoding="utf-8"), encoding="utf-8")
        count += 1
    return count


# ---------------------------------------------------------------------------
# CLI entrypoint — `uv run python -m scripts.tabiya_build.validate_explain <line>`
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _load_catalog(catalog_path: Path) -> Catalog:
    raw = json.loads(catalog_path.read_text(encoding="utf-8"))
    return Catalog.model_validate(raw)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Validate Phase 1b explain sidecars.")
    p.add_argument("line_id", nargs="?", help="single line_id to validate (default: all)")
    p.add_argument(
        "--data-dir",
        type=Path,
        default=REPO_ROOT / "data" / "explain",
        help="sidecar source dir (default: data/explain)",
    )
    p.add_argument(
        "--catalog",
        type=Path,
        default=REPO_ROOT / "public" / "catalog.json",
        help="catalog file (default: public/catalog.json)",
    )
    args = p.parse_args(argv)

    catalog = _load_catalog(args.catalog)

    if args.line_id:
        target = args.data_dir / f"{args.line_id}.json"
        if not target.exists():
            print(f"error: sidecar not found: {target}", file=sys.stderr)
            return 2
        try:
            validate_sidecar_file(target, catalog)
        except ExplainValidationError as e:
            print(f"FAIL: {e}", file=sys.stderr)
            return 1
        print(f"OK: {args.line_id}")
        return 0

    try:
        sidecars = validate_all_explain_sidecars(args.data_dir, catalog)
    except ExplainValidationError as e:
        print(f"FAIL: {e}", file=sys.stderr)
        return 1
    print(f"OK: {len(sidecars)} sidecar(s) validated under {args.data_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
