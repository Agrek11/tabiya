"""Token-bucket rate-limiter tests (clock-mocked)."""

from __future__ import annotations

from scripts.key_squares.lib.ratelimit import TokenBucketLimiter


class FakeClock:
    """Synthetic monotonic clock; advances on each sleep() call."""

    def __init__(self) -> None:
        self.now = 0.0
        self.sleep_calls: list[float] = []

    def time(self) -> float:
        return self.now

    def sleep(self, seconds: float) -> None:
        self.sleep_calls.append(seconds)
        self.now += seconds


def test_first_call_no_sleep() -> None:
    clock = FakeClock()
    limiter = TokenBucketLimiter(default_rps=1.0, clock=clock.time, sleeper=clock.sleep)
    limiter.wait("example.com")
    assert clock.sleep_calls == []


def test_second_call_sleeps_to_meet_rps() -> None:
    clock = FakeClock()
    limiter = TokenBucketLimiter(default_rps=1.0, clock=clock.time, sleeper=clock.sleep)
    limiter.wait("example.com")
    limiter.wait("example.com")
    # Must have slept ~1 second to refill 1 token at 1 rps
    assert len(clock.sleep_calls) == 1
    assert abs(clock.sleep_calls[0] - 1.0) < 1e-6


def test_independent_hosts_dont_block_each_other() -> None:
    clock = FakeClock()
    limiter = TokenBucketLimiter(default_rps=1.0, clock=clock.time, sleeper=clock.sleep)
    limiter.wait("a.example.com")
    limiter.wait("b.example.com")
    assert clock.sleep_calls == []


def test_per_host_rps_overrides_default() -> None:
    clock = FakeClock()
    limiter = TokenBucketLimiter(default_rps=1.0, clock=clock.time, sleeper=clock.sleep)
    # 2 rps → 0.5s spacing
    limiter.configure_host("fast.example.com", 2.0)
    limiter.wait("fast.example.com")
    limiter.wait("fast.example.com")
    assert abs(clock.sleep_calls[0] - 0.5) < 1e-6


def test_url_or_host_accepted() -> None:
    clock = FakeClock()
    limiter = TokenBucketLimiter(default_rps=1.0, clock=clock.time, sleeper=clock.sleep)
    limiter.wait("https://example.com/path/x")
    limiter.wait("example.com")
    # second call to the same host (extracted from URL) MUST sleep
    assert clock.sleep_calls and abs(clock.sleep_calls[0] - 1.0) < 1e-6
