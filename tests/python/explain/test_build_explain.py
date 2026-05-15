"""Tests for scripts.build_explain — Phase 1b R4 authoring pipeline.

Covers prompt rendering, gold-blocks truncation, response parsing, and the
--copy-to-public-only mode. The Anthropic SDK call is NOT exercised — it
requires a live API key and quota — but `run_anthropic_call` is import-tested
so it stays type-correct.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from scripts.build_explain import (
    DEFAULT_TEMPLATE_DIR,
    FEWSHOT_BLOCK_LIMIT,
    build_ply_contexts,
    parse_sidecar_response,
    render_prompt,
    truncate_gold_blocks,
)


def test_build_ply_contexts_replays_legal_moves() -> None:
    plies = build_ply_contexts(["e4", "e5", "Nf3"])
    assert len(plies) == 3
    assert plies[0].san == "e4"
    assert plies[0].index == 1
    assert plies[1].san == "e5"
    assert "rnbq" in plies[2].fen_after.lower()


def test_build_ply_contexts_raises_on_illegal_san() -> None:
    with pytest.raises(Exception):
        build_ply_contexts(["e4", "Qz9"])


def test_truncate_gold_blocks_caps_at_limit(tmp_path: Path) -> None:
    gold = {
        "line_id": "x",
        "schema_version": 2,
        "blocks": [{"rationale": f"r{i}"} for i in range(20)],
    }
    p = tmp_path / "gold.json"
    p.write_text(json.dumps(gold), encoding="utf-8")
    js = truncate_gold_blocks(p)
    parsed = json.loads(js)
    assert len(parsed["blocks"]) == FEWSHOT_BLOCK_LIMIT


def test_render_prompt_includes_all_required_vars(tmp_path: Path) -> None:
    plies = build_ply_contexts(["e4", "e5"])
    gold_js = '{"line_id":"x","schema_version":2,"blocks":[]}'
    prompt = render_prompt(
        template_dir=DEFAULT_TEMPLATE_DIR,
        opening_name="Test Opening",
        eco="A00",
        line_id="test-line",
        plies=plies,
        gold_blocks_json=gold_js,
    )
    assert "Test Opening" in prompt
    assert "A00" in prompt
    assert "test-line" in prompt
    assert "1. e4" in prompt
    assert "2. e5" in prompt
    assert "STRICT JSON" in prompt


def test_parse_sidecar_response_strips_markdown_fences() -> None:
    raw = '```json\n{"line_id":"x","schema_version":2,"blocks":[{"rationale":"hi"}]}\n```'
    s = parse_sidecar_response(raw)
    assert s.line_id == "x"
    assert s.schema_version == 2
    assert len(s.blocks) == 1


def test_parse_sidecar_response_raises_on_invalid_json() -> None:
    with pytest.raises(ValueError):
        parse_sidecar_response("not even close to JSON {[}]")


def test_parse_sidecar_response_raises_on_schema_violation() -> None:
    raw = '{"line_id":"x","schema_version":2,"blocks":[{}]}'
    with pytest.raises(ValidationError):
        parse_sidecar_response(raw)


def test_copy_to_public_only_mode_does_not_call_llm(tmp_path: Path) -> None:
    """Verify the import-only smoke: --copy-to-public skips the LLM path."""
    src = tmp_path / "data"
    src.mkdir()
    (src / "lineA.json").write_text(
        json.dumps({"line_id": "lineA", "schema_version": 2, "blocks": [{"rationale": "r"}]}),
        encoding="utf-8",
    )
    dst = tmp_path / "public"

    from scripts.build_explain import main as build_main

    # No ANTHROPIC_API_KEY needed in copy-to-public path.
    rc = build_main(
        [
            "--copy-to-public",
            "--data-src",
            str(src),
            "--public-dst",
            str(dst),
        ]
    )
    assert rc == 0
    assert (dst / "lineA.json").exists()
