"""Wikipedia + Lichess adapter tests (mock HTTP)."""

from __future__ import annotations

from unittest.mock import MagicMock

import httpx

from scripts.key_squares.adapters.lichess_explorer import LichessExplorerAdapter
from scripts.key_squares.adapters.wikipedia import WikipediaAdapter

WIKI_HTML_SAMPLE = """
<html><body>
<div id="mw-content-text">
<p>The <b>Italian Game</b> is one of the oldest recorded chess openings.
It begins with the moves 1.e4 e5 2.Nf3 Nc6 3.Bc4. The bishop on c4 targets
the f7 square, Black's weakest point in the opening.</p>
<p>Mainline theory examines the Giuoco Piano (3...Bc5) and the Two Knights
Defense (3...Nf6), each with extensive analysis going back centuries.</p>
</div>
<h2 id="References">References</h2>
<p>This paragraph should be cut off.</p>
</body></html>
"""

WIKI_DISAMBIG_HTML = """
<html><body>
<p>Italian may refer to:</p>
<ul class="hatnote-list"><li>Italian Game</li></ul>
</body></html>
"""


def _mock_response(status: int = 200, text: str = "", json_payload: dict | None = None):
    resp = MagicMock(spec=httpx.Response)
    resp.status_code = status
    resp.text = text
    if json_payload is not None:
        resp.json = MagicMock(return_value=json_payload)
    return resp


# --- WikipediaAdapter ------------------------------------------------------


def test_wikipedia_discover_returns_url_for_opening_name() -> None:
    client = MagicMock()
    adapter = WikipediaAdapter(http_client=client)
    urls = adapter.discover("italian-game-main", "Italian Game, Main Line")
    assert any("Italian_Game" in u for u in urls)
    assert all(u.startswith("https://en.wikipedia.org/wiki/") for u in urls)


def test_wikipedia_fetch_returns_prose_chunk() -> None:
    client = MagicMock()
    client.get.return_value = _mock_response(status=200, text=WIKI_HTML_SAMPLE)
    adapter = WikipediaAdapter(http_client=client)
    chunk = adapter.fetch("https://en.wikipedia.org/wiki/Italian_Game")
    assert chunk is not None
    assert chunk.license == "CC-BY-SA-4.0"
    assert "Italian Game" in chunk.text
    assert "f7" in chunk.text
    # References section should be cut before reaching us
    assert "This paragraph should be cut off" not in chunk.text


def test_wikipedia_fetch_404_returns_none() -> None:
    client = MagicMock()
    client.get.return_value = _mock_response(status=404, text="not found")
    adapter = WikipediaAdapter(http_client=client)
    assert adapter.fetch("https://en.wikipedia.org/wiki/Nonexistent") is None


def test_wikipedia_fetch_disambiguation_returns_none() -> None:
    client = MagicMock()
    client.get.return_value = _mock_response(status=200, text=WIKI_DISAMBIG_HTML)
    adapter = WikipediaAdapter(http_client=client)
    assert adapter.fetch("https://en.wikipedia.org/wiki/Italian") is None


def test_wikipedia_fetch_network_error_returns_none() -> None:
    client = MagicMock()
    client.get.side_effect = httpx.ConnectError("simulated")
    adapter = WikipediaAdapter(http_client=client)
    assert adapter.fetch("https://en.wikipedia.org/wiki/X") is None


# --- LichessExplorerAdapter ------------------------------------------------


def test_lichess_discover_returns_empty_list() -> None:
    # Lichess is FEN-driven; the scrape driver passes the FEN directly.
    adapter = LichessExplorerAdapter()
    assert adapter.discover("any-slug", "Any Name") == []


def test_lichess_fetch_returns_chunk_when_opening_present() -> None:
    payload = {
        "white": 100,
        "draws": 50,
        "black": 80,
        "moves": [],
        "opening": {"name": "Italian Game", "eco": "C50"},
    }
    client = MagicMock()
    client.get.return_value = _mock_response(status=200, json_payload=payload)
    adapter = LichessExplorerAdapter(http_client=client)
    chunk = adapter.fetch("https://explorer.lichess.ovh/masters?fen=xxx")
    assert chunk is not None
    assert chunk.license == "ODbL-1.0"
    assert "Italian Game" in chunk.text
    assert "C50" in chunk.text


def test_lichess_fetch_none_when_no_opening() -> None:
    payload = {"white": 0, "draws": 0, "black": 0, "moves": [], "opening": None}
    client = MagicMock()
    client.get.return_value = _mock_response(status=200, json_payload=payload)
    adapter = LichessExplorerAdapter(http_client=client)
    assert adapter.fetch("https://explorer.lichess.ovh/masters?fen=xxx") is None
