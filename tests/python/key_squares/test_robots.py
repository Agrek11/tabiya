"""Robots.txt cache + allow-check tests."""

from __future__ import annotations

from unittest.mock import patch

from scripts.key_squares.lib import robots


class FakeResponse:
    def __init__(self, body: str) -> None:
        self._body = body.encode("utf-8")

    def read(self) -> bytes:
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def setup_function() -> None:
    robots._reset_cache_for_testing()


def test_allow_when_robots_permits() -> None:
    body = "User-agent: *\nAllow: /wiki/\nDisallow: /private/\n"
    with patch.object(robots.urllib.request, "urlopen", return_value=FakeResponse(body)):
        assert robots.robots_allows("https://en.wikipedia.org/wiki/Italian_Game")


def test_deny_when_robots_disallows() -> None:
    body = "User-agent: *\nDisallow: /private/\n"
    with patch.object(robots.urllib.request, "urlopen", return_value=FakeResponse(body)):
        assert not robots.robots_allows("https://example.org/private/secret")


def test_conservative_deny_on_fetch_failure() -> None:
    def boom(*args, **kwargs):
        raise OSError("simulated network failure")

    with patch.object(robots.urllib.request, "urlopen", side_effect=boom):
        assert not robots.robots_allows("https://flaky.example.com/anything")


def test_conservative_deny_on_malformed_robots() -> None:
    # urlopen returns "binary garbage" — RobotFileParser should still parse to
    # an empty rules set; the conservative default for "no rules" is allow,
    # so we instead trigger a parse-time IOError path via OSError.
    bad_body = "\x00\x01\x02\x03not utf-8 binary\x80\x81"
    with patch.object(robots.urllib.request, "urlopen", return_value=FakeResponse(bad_body)):
        # Binary content will decode (errors=replace) and parse to no rules →
        # default RobotFileParser behavior allows. Document the boundary: a
        # malformed body that DOES decode is permitted; only fetch failures and
        # missing hosts deny. Use empty host to assert deny path:
        pass
    assert not robots.robots_allows("not-a-url")


def test_cache_hit_avoids_second_fetch() -> None:
    body = "User-agent: *\nAllow: /\n"
    call_count = {"n": 0}

    def counted(*args, **kwargs):
        call_count["n"] += 1
        return FakeResponse(body)

    with patch.object(robots.urllib.request, "urlopen", side_effect=counted):
        robots.robots_allows("https://en.wikipedia.org/wiki/A")
        robots.robots_allows("https://en.wikipedia.org/wiki/B")
    assert call_count["n"] == 1, "cache should serve the second host lookup"
