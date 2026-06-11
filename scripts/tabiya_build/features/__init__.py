"""Phase 4b — deterministic position-feature extraction (build-time).

Computes ~30 verifiable positional facts per catalog position so the Coach's
LLM narrates from provided truth instead of guessing chess (the moat's first
symbolic layer). Runs inside the catalog build; ships as the
``public/features.json`` sidecar keyed by normalized-FEN sha1-16 hash.

Spec of record for any ambiguous definition is the golden fixture set at
``evals/features/golden/`` (requirements-4b.md R5).
"""

from .extract import EXTRACTOR_VERSION, extract_features

__all__ = ["EXTRACTOR_VERSION", "extract_features"]
