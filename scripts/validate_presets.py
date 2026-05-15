"""Validate that every `lines:` entry in scripts/curated/presets.yml exists in
the built `public/catalog.json`.

Run as part of the build (or pre-commit). Non-zero exit on mismatch so a
build cannot quietly ship a preset that references a removed line.

Constitution Article 14 — Python is primary for build tooling; full type
hints; fails loud.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Final


REPO_ROOT: Final[Path] = Path(__file__).resolve().parent.parent
PRESETS_PATH: Final[Path] = REPO_ROOT / "scripts" / "curated" / "presets.yml"
CATALOG_PATH: Final[Path] = REPO_ROOT / "public" / "catalog.json"


def load_presets(path: Path) -> list[dict[str, object]]:
    """Load presets.yml. Uses PyYAML if available, otherwise a tiny inline
    parser that handles only the subset we actually emit (lists of dicts
    with scalar + list-of-string fields). The inline parser keeps the
    build dependency-free for CI environments that don't pre-install yaml.
    """
    text = path.read_text(encoding="utf-8")
    try:
        import yaml  # type: ignore[import-not-found]

        parsed = yaml.safe_load(text)
    except ImportError:
        parsed = _parse_presets_yaml_subset(text)

    if not isinstance(parsed, dict):
        raise SystemExit(f"presets.yml: expected top-level mapping, got {type(parsed)}")
    presets = parsed.get("presets")
    if not isinstance(presets, list):
        raise SystemExit("presets.yml: missing or non-list 'presets'")
    return presets  # type: ignore[return-value]


def _parse_presets_yaml_subset(text: str) -> dict[str, object]:
    """Tiny YAML subset parser for our preset shape only. Handles `- key: val`
    list items, scalar values, inline `[a, b]` lists, and indented block
    lists with `- value` lines. Comments and blank lines are skipped.

    Restricted to our exact schema; throws on anything unexpected so a
    surprise format change does not silently pass validation.
    """
    presets: list[dict[str, object]] = []
    current: dict[str, object] | None = None
    current_list_key: str | None = None

    for raw_line in text.splitlines():
        line = raw_line.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        stripped = line.lstrip(" ")
        indent = len(line) - len(stripped)

        if stripped == "presets:":
            continue

        if indent == 2 and stripped.startswith("- "):
            # Start of a new preset entry.
            if current is not None:
                presets.append(current)
            current = {}
            current_list_key = None
            after = stripped[2:]
            if ":" in after:
                key, _, val = after.partition(":")
                current[key.strip()] = _parse_scalar_or_list(val.strip())
            continue

        if current is None:
            continue

        if indent == 4 and ":" in stripped and not stripped.startswith("- "):
            key, _, val = stripped.partition(":")
            key = key.strip()
            val = val.strip()
            if val == "":
                current_list_key = key
                current[key] = []
            else:
                current[key] = _parse_scalar_or_list(val)
                current_list_key = None
            continue

        if indent >= 6 and stripped.startswith("- "):
            if current_list_key is None:
                raise SystemExit(f"presets.yml: stray list item: {line!r}")
            value = stripped[2:].strip()
            target = current[current_list_key]
            if not isinstance(target, list):
                raise SystemExit(f"presets.yml: not a list field: {current_list_key}")
            target.append(_parse_scalar(value))
            continue

    if current is not None:
        presets.append(current)
    return {"presets": presets}


def _parse_scalar(val: str) -> object:
    if val == "true":
        return True
    if val == "false":
        return False
    try:
        return int(val)
    except ValueError:
        pass
    return val.strip('"').strip("'")


def _parse_scalar_or_list(val: str) -> object:
    if val.startswith("[") and val.endswith("]"):
        inner = val[1:-1].strip()
        if inner == "":
            return []
        return [_parse_scalar(p.strip()) for p in inner.split(",")]
    return _parse_scalar(val)


def load_catalog_line_ids(path: Path) -> set[str]:
    catalog = json.loads(path.read_text(encoding="utf-8"))
    lines = catalog.get("lines")
    if not isinstance(lines, list):
        raise SystemExit(f"{path}: missing 'lines' array")
    ids: set[str] = set()
    for line in lines:
        if isinstance(line, dict) and isinstance(line.get("id"), str):
            ids.add(line["id"])
    return ids


def main() -> int:
    if not PRESETS_PATH.exists():
        print(f"validate_presets: missing {PRESETS_PATH}", file=sys.stderr)
        return 2
    if not CATALOG_PATH.exists():
        print(f"validate_presets: missing {CATALOG_PATH}", file=sys.stderr)
        return 2

    presets = load_presets(PRESETS_PATH)
    valid_ids = load_catalog_line_ids(CATALOG_PATH)

    errors: list[str] = []
    for preset in presets:
        pid = preset.get("id", "?")
        lines = preset.get("lines", [])
        if not isinstance(lines, list):
            errors.append(f"preset {pid}: 'lines' must be a list")
            continue
        for line_id in lines:
            if not isinstance(line_id, str):
                errors.append(f"preset {pid}: non-string line entry {line_id!r}")
                continue
            if line_id not in valid_ids:
                errors.append(f"preset {pid}: unknown line id '{line_id}'")

    if errors:
        for e in errors:
            print(f"validate_presets: {e}", file=sys.stderr)
        return 1

    total_refs = sum(
        len(p.get("lines", [])) for p in presets if isinstance(p.get("lines"), list)
    )
    print(
        f"validate_presets: OK — {len(presets)} presets, "
        f"{total_refs} line references all resolve."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
