"""Token-bucket rate limiter per host.

Lives in the scrape driver layer (not adapters) so a misbehaving adapter
cannot bypass it. Default ≤1 req/sec/host; configurable per source via
``rate_limit_rps`` in ``sources.yml``.

The clock is injectable so tests can advance synthetic time without sleeping.
"""

from __future__ import annotations

import time as _real_time
from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlparse


@dataclass
class _Bucket:
    capacity: float
    refill_rate_rps: float
    tokens: float
    last_ts: float


class TokenBucketLimiter:
    """Per-host token-bucket. One token per request; bucket refills at rps."""

    def __init__(
        self,
        *,
        default_rps: float = 1.0,
        clock: Callable[[], float] = _real_time.monotonic,
        sleeper: Callable[[float], None] = _real_time.sleep,
    ) -> None:
        self._default_rps = default_rps
        self._clock = clock
        self._sleeper = sleeper
        self._buckets: dict[str, _Bucket] = {}
        # Capacity 1 means consecutive requests to one host are spaced ≥1/rps
        # apart; bursts are not allowed. This is the conservative posture per
        # R1.3 (rate limit ≤1 req/sec).
        self._capacity = 1.0

    def configure_host(self, host: str, rps: float) -> None:
        """Set a custom rate (req/sec) for a host. Default rate applies otherwise."""
        if host not in self._buckets:
            self._buckets[host] = _Bucket(
                capacity=self._capacity,
                refill_rate_rps=rps,
                tokens=self._capacity,
                last_ts=self._clock(),
            )
        else:
            self._buckets[host].refill_rate_rps = rps

    def _bucket_for(self, host: str) -> _Bucket:
        if host not in self._buckets:
            self._buckets[host] = _Bucket(
                capacity=self._capacity,
                refill_rate_rps=self._default_rps,
                tokens=self._capacity,
                last_ts=self._clock(),
            )
        return self._buckets[host]

    def wait(self, host_or_url: str) -> None:
        """Block until a token is available for the host, then consume it.

        Accepts a bare host or a full URL (host extracted via urlparse).
        """
        host = self._host_of(host_or_url)
        bucket = self._bucket_for(host)
        now = self._clock()
        elapsed = max(0.0, now - bucket.last_ts)
        bucket.tokens = min(bucket.capacity, bucket.tokens + elapsed * bucket.refill_rate_rps)
        bucket.last_ts = now
        if bucket.tokens < 1.0:
            needed = 1.0 - bucket.tokens
            sleep_for = needed / bucket.refill_rate_rps
            self._sleeper(sleep_for)
            bucket.tokens = 0.0
            bucket.last_ts = self._clock()
        else:
            bucket.tokens -= 1.0

    @staticmethod
    def _host_of(host_or_url: str) -> str:
        if "://" in host_or_url:
            return urlparse(host_or_url).netloc or host_or_url
        return host_or_url
