"""LLM extractor tests (Anthropic SDK mocked)."""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock

import pytest

from scripts.key_squares.extract import (
    KeySquareDraft,
    build_prompt,
    extract_for_opening,
    load_few_shot,
    parse_json_from_text,
    write_pending,
)


def _record() -> dict:
    return {
        "opening_slug": "italian-game-main",
        "opening_name": "Italian Game",
        "fen_after_main_line": "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3",
        "prose_chunks": [
            {
                "source_url": "https://en.wikipedia.org/wiki/Italian_Game",
                "license": "CC-BY-SA-4.0",
                "text": "The Italian Game targets f7, Black's weakest square in the opening.",
            }
        ],
    }


def _text_block(payload: dict) -> MagicMock:
    block = MagicMock()
    block.text = json.dumps(payload)
    return block


def _make_message(payload: dict) -> MagicMock:
    msg = MagicMock()
    msg.content = [_text_block(payload)]
    return msg


# --- few-shot exemplars ----------------------------------------------------


def test_few_shot_exemplars_load_and_validate() -> None:
    exemplars = load_few_shot()
    assert len(exemplars) >= 5
    roles = {d.role for ex in exemplars for d in ex.output}
    # Spec wants all four roles represented across the 5 exemplars
    assert roles == {"outpost", "control", "tension", "weak"}


# --- prompt builder --------------------------------------------------------


def test_build_prompt_includes_opening_metadata_and_sources() -> None:
    exemplars = load_few_shot()
    prompt = build_prompt(_record(), exemplars)
    assert "Italian Game" in prompt
    assert "italian-game-main" in prompt
    assert "[Source: https://en.wikipedia.org/wiki/Italian_Game]" in prompt
    assert "Few-shot examples:" in prompt
    assert '"drafts"' in prompt  # output contract referenced


# --- parse_json_from_text --------------------------------------------------


def test_parse_json_handles_plain_object() -> None:
    payload = parse_json_from_text('{"drafts": []}')
    assert payload == {"drafts": []}


def test_parse_json_strips_code_fence() -> None:
    payload = parse_json_from_text('```json\n{"drafts": []}\n```')
    assert payload == {"drafts": []}


def test_parse_json_raises_when_no_object() -> None:
    with pytest.raises(json.JSONDecodeError):
        parse_json_from_text("no json here, just prose")


# --- extract_for_opening (SDK mocked) --------------------------------------


def _good_draft() -> dict:
    return {
        "square": "f7",
        "role": "weak",
        "for_color": "black",
        "rationale": "Defended only by the king",
        "source_url": "https://en.wikipedia.org/wiki/Italian_Game",
    }


def test_extract_returns_validated_drafts() -> None:
    client = MagicMock()
    client.messages.create.return_value = _make_message({"drafts": [_good_draft()]})
    drafts = extract_for_opening(_record(), client, exemplars=load_few_shot())
    assert len(drafts) == 1
    assert drafts[0].square == "f7"


def test_extract_drops_all_drafts_on_validation_error() -> None:
    bad = {**_good_draft(), "square": "z9"}  # invalid
    client = MagicMock()
    client.messages.create.return_value = _make_message({"drafts": [bad]})
    drafts = extract_for_opening(_record(), client, exemplars=load_few_shot())
    assert drafts == []


def test_extract_returns_empty_on_json_parse_error() -> None:
    bad_block = MagicMock()
    bad_block.text = "not json {{{ garbage"
    msg = MagicMock()
    msg.content = [bad_block]
    client = MagicMock()
    client.messages.create.return_value = msg
    drafts = extract_for_opening(_record(), client, exemplars=load_few_shot())
    assert drafts == []


def test_extract_retries_on_rate_limit_then_succeeds() -> None:
    import anthropic

    sleep_calls: list[float] = []
    msg = _make_message({"drafts": [_good_draft()]})
    # Construct minimal RateLimitError; SDK accepts a dummy response/body.
    rate_err = anthropic.RateLimitError(
        message="rate limited",
        response=MagicMock(status_code=429, headers={}),
        body=None,
    )
    client = MagicMock()
    client.messages.create.side_effect = [rate_err, rate_err, msg]
    drafts = extract_for_opening(
        _record(),
        client,
        exemplars=load_few_shot(),
        sleeper=sleep_calls.append,
    )
    # 1s, 2s backoff before the 3rd successful attempt
    assert sleep_calls == [1, 2]
    assert len(drafts) == 1


def test_extract_returns_empty_when_all_retries_fail() -> None:
    import anthropic

    rate_err = anthropic.RateLimitError(
        message="rate limited",
        response=MagicMock(status_code=429, headers={}),
        body=None,
    )
    client = MagicMock()
    client.messages.create.side_effect = [rate_err, rate_err, rate_err]
    drafts = extract_for_opening(
        _record(),
        client,
        exemplars=load_few_shot(),
        sleeper=lambda _: None,
    )
    assert drafts == []


# --- write_pending ---------------------------------------------------------


def test_write_pending_emits_yaml_with_metadata(tmp_path: Path) -> None:
    drafts = [KeySquareDraft.model_validate(_good_draft())]
    path = write_pending(_record(), drafts, out_dir=tmp_path)
    assert path.exists()
    body = path.read_text(encoding="utf-8")
    assert "opening_slug: italian-game-main" in body
    assert "extracted_at:" in body
    assert "f7" in body
