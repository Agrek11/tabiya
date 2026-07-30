# ADR 0002: Stockfish request cancellation

Status: accepted — 2026-07-28.

A global UCI `stop` silently cleared the serial worker queue, leaving unrelated main-thread promises pending. The browser/worker protocol now carries unique request IDs, `cancel` messages, and `cancelled` responses. Only `stop()` cancels all work. Main-thread calls clean abort listeners and settle on cancellation, timeout, dispose, or fatal worker failure.

Consequences: Coach and Play requests can share the serial worker without one caller aborting another caller's work.
