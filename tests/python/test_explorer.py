"""Tests for ExplorerClient — cache + retry + parsing.

All network calls are mocked; no live API hits.
"""

from __future__ import annotations

import json
from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx

from scripts.tabiya_build.explorer import ExplorerClient, _fen_hash, _parse_response

SAMPLE_RESPONSE = {
    "white": 1234,
    "draws": 567,
    "black": 890,
    "moves": [
        {"san": "e4", "uci": "e2e4", "white": 600, "draws": 300, "black": 400},
        {"san": "d4", "uci": "d2d4", "white": 500, "draws": 200, "black": 300},
        {"san": "c4", "uci": "c2c4", "white": 100, "draws": 50, "black": 80},
    ],
    "opening": {"name": "Sample Opening", "eco": "X00"},
}


class TestParseResponse:
    def test_parses_top_level(self) -> None:
        r = _parse_response(SAMPLE_RESPONSE)
        assert r.total_games == 1234 + 567 + 890
        assert r.opening_name == "Sample Opening"

    def test_parses_moves(self) -> None:
        r = _parse_response(SAMPLE_RESPONSE)
        assert len(r.moves) == 3
        assert r.moves[0].san == "e4"
        assert r.moves[0].total_games == 600 + 300 + 400

    def test_handles_missing_opening(self) -> None:
        data = dict(SAMPLE_RESPONSE)
        data.pop("opening")
        r = _parse_response(data)
        assert r.opening_name is None


class TestExplorerClientCache:
    def test_cache_hit_skips_http(self, tmp_path: Path) -> None:
        cache = tmp_path / "explorer"
        cache.mkdir()
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"
        (cache / f"{_fen_hash(fen)}.json").write_text(json.dumps(SAMPLE_RESPONSE))

        with ExplorerClient(cache) as client:
            with patch("scripts.tabiya_build.explorer.httpx.Client") as mock_cls:
                resp = client.fetch(fen)
        assert resp.opening_name == "Sample Opening"
        mock_cls.assert_not_called()

    def test_cache_miss_calls_http_and_writes_cache(self, tmp_path: Path) -> None:
        cache = tmp_path / "explorer"
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.status_code = 200
        mock_resp.json = MagicMock(return_value=SAMPLE_RESPONSE)
        mock_resp.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.get.return_value = mock_resp

        with ExplorerClient(cache) as client:
            with patch.object(client, "_ensure_client", return_value=mock_client):
                resp = client.fetch(fen)

        assert resp.opening_name == "Sample Opening"
        assert (cache / f"{_fen_hash(fen)}.json").exists()


class TestExplorerClientRetry:
    def test_retries_on_429(self, tmp_path: Path) -> None:
        cache = tmp_path / "explorer"
        fen = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1"

        # First two responses 429 (raise), third succeeds.
        rate_limited = MagicMock(spec=httpx.Response)
        rate_limited.status_code = 429
        rate_limited.request = MagicMock()

        ok = MagicMock(spec=httpx.Response)
        ok.status_code = 200
        ok.json = MagicMock(return_value=SAMPLE_RESPONSE)
        ok.raise_for_status = MagicMock()

        call_count = {"n": 0}

        def get_side_effect(*_args: object, **_kwargs: object) -> MagicMock:
            call_count["n"] += 1
            if call_count["n"] < 3:
                return rate_limited
            return ok

        mock_client = MagicMock()
        mock_client.get.side_effect = get_side_effect

        with ExplorerClient(cache) as client:
            with patch.object(client, "_ensure_client", return_value=mock_client):
                # Tenacity sleeps on retry; bypass via global time.sleep patch.
                with patch("time.sleep"):
                    resp = client.fetch(fen)

        assert call_count["n"] == 3
        assert resp.opening_name == "Sample Opening"
