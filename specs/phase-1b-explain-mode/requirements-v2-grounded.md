# Requirements: Explain Mode v2 — Grounded, Deterministic Regeneration

## Decision (locked 2026-06-18)

Replace the Phase-1b GPT-batch Explain pipeline (`build_explain.py`) with
**deterministic, grounded per-ply rationale rendered from the moat data already
shipped to the browser**, plus an OPTIONAL LLM polish pass. Strategy chosen over
"grounded LLM scribe (every line)" and "no sidecars / runtime Coach per ply".

## Why the v1 content was scrapped

The Phase-1b pipeline predates the feature engine. It is a pure GPT "opening-
theory annotator" that uses **no engine and no features** (the prompt explicitly
says "avoid engine eval scores"), writes freeform beginner prose (generic, hand-
wavy), has the **LLM guess arrows/highlights** (geometry can be wrong), does not
scale (1 of 51 lines authored), and is the "thin LLM wrapper" Article 4 rejects.

Meanwhile the moat already exists and is unused by Explain:
`features.json` (all 587 catalog positions, fen-hash keyed), motifs,
classification, `key_squares` (per line in `catalog.json`), `SidecarFeatureExtractor`,
and `renderFeaturesBlock` (facts → prose).

## Architecture — render at runtime from shipped data

Explain content is no longer authored. Per ply, ExplainView derives everything
from data already on the page:

```
ply → fen-after (useExplainMode walks the line, chess.js)
    → fen-hash → SidecarFeatureExtractor lookup in features.json   (facts)
    → explain-tuned renderer (move-aware)                          (rationale)
    → arrows  = played move from/to (chess.js)                     (deterministic)
    → highlights = line.key_squares ∪ motif squares                (deterministic)
```

- **All 51 catalog lines light up immediately** — Explain availability stops
  being gated on an authored sidecar (fixes audit finding #2 with zero content
  files). Off-catalog plies (hash miss) degrade to a move-only rationale or the
  Coach path, per Article 11.
- Grounded, free, offline, zero-hallucination by construction.

## The one real build piece — an explain-tuned renderer

`renderFeaturesBlock` frames a *position* ("Position type: …"). Explain needs
*move-aware consequence* framing ("this move plants a knight on the d5 outpost;
no black pawn can challenge it"). Build a thin renderer that takes (playedMove,
factsBefore?, factsAfter) → 1–3 sentence consequence prose, reusing the same
`PositionFeatures` structs. Deterministic, unit-tested against fixtures.

## Optional LLM polish (sugar, never a dependency)

A build-time pass MAY rewrite the deterministic rationale into smoother prose,
stored as an **override sidecar** (`public/explain/<lineId>.json`, same
`ExplainBlock[]` shape). ExplainView prefers a polished override when present,
else renders deterministically at runtime. Gated by API key + human review;
absence changes nothing functional. The grounded v2 scribe prompt (cite-facts-
only) is reused if/when this runs.

## Migration / teardown

- Deprecate + remove `scripts/build_explain.py` and `build_explain.j2` (GPT-batch
  authoring) once the runtime renderer ships.
- Regenerate or delete the single weak `italian-giuoco-pianissimo-main.json`.
- `useExplainContent` inverts: runtime generation is PRIMARY; an override sidecar
  (if any) is the optional source. The "missing sidecar ⇒ Explain disabled" gate
  is removed.
- `ExplainBlock` type unchanged (rationale/arrows/highlights/threats).

## Constitution

- Article 4 — deterministic, fixture-backed; LLM only an optional polish, not the
  source of chess claims.
- Article 11 — runs in-browser from shipped assets; no network needed; degrades
  on hash miss.
- Article 1/3 — no new deps; reuses existing extractor + renderer.

## Open questions

1. Explain renderer voice — beginner consequence prose vs the Coach's neutral
   position description. Likely a distinct template over the same facts.
2. Off-catalog plies in Explain (rare mid-line) — move-only rationale vs invoke
   Coach. Bias: move-only for the autoplay walk; Coach on demand.
3. Whether to keep an override-sidecar mechanism at all, or ship deterministic-
   only for v2 and add polish later. Bias: deterministic-only first.
