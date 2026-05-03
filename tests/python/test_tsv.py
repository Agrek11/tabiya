"""Tests for TSV parser. Parser tests use a checked-in fixture; download is mocked."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import httpx

from scripts.tabiya_build.tsv import (
    download_tsv,
    parse_all,
    parse_tsv,
)

FIXTURE = Path(__file__).parent / "fixtures" / "tsv" / "sample.tsv"


class TestParseTsv:
    def test_parses_known_rows(self) -> None:
        rows = parse_tsv(FIXTURE)
        # 5 data rows
        assert len(rows) == 5
        ruy = next(r for r in rows if r.eco == "C60")
        assert ruy.name == "Spanish Game"
        assert ruy.san_moves == ("e4", "e5", "Nf3", "Nc6", "Bb5")

    def test_skips_header(self) -> None:
        rows = parse_tsv(FIXTURE)
        assert all(r.eco != "eco" for r in rows)

    def test_san_moves_canonicalized(self) -> None:
        rows = parse_tsv(FIXTURE)
        sicilian = next(r for r in rows if r.eco == "B20")
        assert sicilian.san_moves == ("e4", "c5")


class TestParseAll:
    def test_concatenates(self) -> None:
        rows = parse_all([FIXTURE, FIXTURE])
        assert len(rows) == 10  # parsed twice


class TestDownloadTsv:
    def test_cache_hit_skips_network(self, tmp_path: Path) -> None:
        # Pre-seed cache
        cache = tmp_path / "cache"
        cache.mkdir()
        (cache / "a.tsv").write_text("eco\tname\tpgn\n", encoding="utf-8")

        with patch("scripts.tabiya_build.tsv.httpx.Client") as mock_client_cls:
            result = download_tsv("a", cache)
        assert result == cache / "a.tsv"
        mock_client_cls.assert_not_called()

    def test_refresh_overwrites_cache(self, tmp_path: Path) -> None:
        cache = tmp_path / "cache"
        cache.mkdir()
        (cache / "a.tsv").write_text("OLD", encoding="utf-8")

        # Mock httpx.Client context manager
        mock_resp = MagicMock(spec=httpx.Response)
        mock_resp.text = "NEW"
        mock_resp.raise_for_status = MagicMock()

        mock_client = MagicMock()
        mock_client.get.return_value = mock_resp
        mock_client.__enter__ = MagicMock(return_value=mock_client)
        mock_client.__exit__ = MagicMock(return_value=None)

        with patch("scripts.tabiya_build.tsv.httpx.Client", return_value=mock_client):
            download_tsv("a", cache, refresh=True)

        assert (cache / "a.tsv").read_text() == "NEW"
