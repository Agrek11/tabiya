# Coach prompt changelog

Prompts are version-pinned text files imported as raw strings so every eval run
is reproducible (Article 4). Bump the version (new file `vN.txt`) on any change
that could move eval numbers; never edit a shipped version in place.

## v1 — 4a baseline (2026-05-31)

- First Coach prompt. Engine-only grounding: Stockfish PVs + last ≤6 plies.
- System block carries the honest-baseline constraint: narrate only what the
  PVs justify; no invented tactics/plans (the symbolic moat layers 4b–4e do not
  exist yet).
- 3 few-shot examples (Italian Game, Sicilian Najdorf, French Advance).
- Slots: `{{engine_preset_name}}`, `{{recent_plies_block}}`, `{{engine_block}}`.
- Expected quality: roughly half of explanations feel shallow/generic by
  design — this is the baseline 4b–4e is measured against.
