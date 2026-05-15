"""robots.txt cache + per-URL allow check.

Conservative on errors: malformed robots, fetch failure → deny. The check
lives in the scrape driver (``scrape.py``), not in adapters, so a misbehaving
adapter cannot bypass it.

Cache lifetime = process lifetime; one scrape run = one CLI invocation.
"""

from __future__ import annotations

import logging
import urllib.request
from urllib.error import URLError
from urllib.parse import urlparse
from urllib.robotparser import RobotFileParser

logger = logging.getLogger(__name__)

# Identify the scraper to source operators; per ``sources.yml`` whitelist, this
# value is used by the driver when making HTTP requests AND by the robots
# fetcher below.
USER_AGENT = "tabiya-key-squares-scraper/0.1 (+https://github.com/Agrek11/tabiya)"

_cache: dict[str, RobotFileParser | None] = {}


def _robots_url_for(host: str, scheme: str = "https") -> str:
    return f"{scheme}://{host}/robots.txt"


def _load_for(host: str, scheme: str) -> RobotFileParser | None:
    rp = RobotFileParser()
    robots_url = _robots_url_for(host, scheme)
    rp.set_url(robots_url)
    try:
        # RobotFileParser.read() uses urllib internally — set a UA via opener.
        req = urllib.request.Request(robots_url, headers={"User-Agent": USER_AGENT})
        with urllib.request.urlopen(req, timeout=10) as resp:
            text = resp.read().decode("utf-8", errors="replace")
        rp.parse(text.splitlines())
        return rp
    except (URLError, TimeoutError, OSError, ValueError) as e:
        # Conservative on fetch / parse failure → return None, caller denies.
        logger.warning("robots.txt fetch failed for %s: %s", host, e)
        return None


def robots_allows(url: str) -> bool:
    """Return True only if robots.txt for the URL's host explicitly permits it.

    Failure modes (network failure, malformed robots, missing host) → deny.
    This is the conservative default per the spec (Article 1 + R1.3).
    """
    parsed = urlparse(url)
    host = parsed.netloc
    scheme = parsed.scheme or "https"
    if not host:
        return False
    if host not in _cache:
        _cache[host] = _load_for(host, scheme)
    rp = _cache[host]
    if rp is None:
        return False
    try:
        return rp.can_fetch(USER_AGENT, url)
    except Exception as e:  # pragma: no cover — defensive
        logger.warning("robots can_fetch error for %s: %s", url, e)
        return False


def _reset_cache_for_testing() -> None:
    """Test-only: drop the in-process robots cache."""
    _cache.clear()
