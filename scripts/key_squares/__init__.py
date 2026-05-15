"""Phase 2a — Key squares content acquisition pipeline.

Offline build pipeline that scrapes permissively-licensed chess opening
prose, extracts structured key-square records via direct Anthropic SDK
calls (Article 3), and lands a hand-reviewed `scripts/curated/key_squares.yml`
that the catalog build consumes.

Runtime app never touches this module — it is purely a build-time tool
(Article 11).
"""
