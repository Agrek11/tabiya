# Phase 1b — Explain Mode Requirements

**Trigger:** Conversation 2026-05-06 (Wed). Wife = beginner user, drill mode rewards memorization but not understanding. Need a sibling pedagogy mode that narrates each ply (user + CPU) with visual focus and rationale before the move plays. Differentiator vs chess.com / Lichess studies / Chessable, which either drill or quiz but rarely walk a learner through a line with paced, per-move "why."

**Relationship to other phases:**
- **Phase 1.5 Pattern Visualization** — reuses the same square-highlight + tooltip primitive (Constitution Article 15). Explain Mode is the temporal counterpart to Pattern Viz's spatial focus.
- **Phase 3 AI Coach** — `explain` blocks are the seed dataset and gold reference for the AI Coach's per-move commentary. Hand/curated content here trains and grounds the LLM later.
- **Article 7 (Linear Lines Only)** — Explain Mode walks linear ply sequences only. No branch narration.
- **Article 13 (Weekend Pace)** — implementation must fit weekend cadence; do not pull from battle-plan time.

**Scope split:**
- This phase (1b): mode toggle, schema extension, explain-block authoring pipeline, autoplay loop, overlay rendering on existing primitive, 1 hand-authored gold line.
- Deferred to 1b.2: GPT-batch authoring across full repertoire; bulk review tooling.
- Deferred to 1b.3: voice-over / TTS narration.

**Out of scope:**
- Branching commentary (Article 7).
- Interactive Q&A on positions (that's Phase 3 AI Coach).
- User-authored explain blocks via in-app editor.

---

## R1 — Mode toggle on drill page

### Acceptance criteria

- [ ] Drill page header exposes a two-state toggle: `[Drill] [Explain]`. Default = Drill (existing behavior).
- [ ] Toggle persists per-line in `localStorage` (key: `tabiya:linePrefs:<lineId>:mode`). Switching lines preserves chosen mode for each.
- [ ] Switching mode mid-line resets board to ply 0 of the line (do not silently jump positions across modes).
- [ ] Mode toggle is hidden / disabled when the active line has no `explain` blocks authored (graceful degrade, not error).
- [ ] Sidebar nav unchanged (Drill is still entered only via Repertoire grid per 0d.1 decision).

---

## R2 — Schema extension for explain blocks

### Acceptance criteria

- [ ] `MoveNode` (catalog line move) gains an optional `explain` field:
  ```ts
  type ExplainBlock = {
    rationale: string;          // 1-3 sentence "why this move"
    arrows?: Arrow[];           // [{from: Square, to: Square, color?: 'green'|'red'|'blue'}]
    highlights?: HighlightSquare[]; // reuses Phase 1.5 primitive shape
    threats?: string;           // optional 2nd-pass deeper note (e.g., "If ...Nxe4 then Re1 pins")
    pauseMs?: number;           // default 2500; per-move override
  };
  ```
- [ ] Schema validated at catalog build time (Phase 0b pipeline). Missing required fields fail the build, not runtime.
- [ ] Catalog version bump (`catalog.schema_version`) to surface old bundles cleanly.
- [ ] Stable line IDs preserved (Article 6). Adding `explain` to existing lines does not renumber anything.
- [ ] `python-chess` and `chess.js` both still consume `san` / `fen` unchanged — `explain` is purely additive.

---

## R3 — Explain Mode autoplay loop

### Acceptance criteria

- [ ] On entering Explain Mode at ply 0, board sits at start position with the first move's overlays (arrows + highlights) rendered, rationale text shown in the right rail.
- [ ] After `pauseMs` (default 2500ms), or on user clicking "Next", the move plays with sound, overlays clear, and the loop advances to next ply.
- [ ] Both colors narrated. CPU moves are not auto-played silently — they get their own pause + overlay + rationale step.
- [ ] User controls visible: `[◀ Prev]` `[⏸ Pause]` `[▶ Next]` `[↻ Restart]` `[⏩ Skip to drill]`.
- [ ] `Pause` halts the auto-advance timer but keeps current overlays. `Next` advances regardless of timer state.
- [ ] On line completion: show end-of-line summary card (existing component if Phase 1.5 ships first, otherwise minimal shell). Offer `[Drill this line]` CTA.
- [ ] Progress bar visible (same component drill mode uses). No new bar.

### Technical approach

State machine (single hook `useExplainMode`):

```
states: idle → showOverlays → playingMove → cleared → next
                ↑__________________________________|
controls: prev / pause / next / restart / skip
```

- Reuse `useDrill`'s line iterator and chess.js instance — do not fork a parallel chess engine.
- Reuse Phase 1.5 `<HighlightLayer>` primitive (Article 15). Add an `<ArrowLayer>` sibling if not already shipped.
- Pause timer = single `setTimeout`, cleared on `pause`/`next`/`prev`/unmount.
- No multi-line state — one explain session = one line.

---

## R4 — Authoring pipeline (gold + batch)

### Acceptance criteria

- [ ] One opening line hand-authored end-to-end as gold reference (target: Italian Game main line, ~10-12 ply). Lives in catalog source under `data/explain/<lineId>.json` or merged inline — pipeline owner picks one.
- [ ] Authoring schema documented in `specs/phase-1b-explain-mode/authoring.md` (separate doc, this phase).
- [ ] GPT-batch script (`scripts/build_explain.py`) takes line FEN sequence + opening name + few-shot from gold line → drafts `ExplainBlock` per ply → writes to a `pending/` dir for manual review.
- [ ] Manual-review CLI (`scripts/review_explain.py`) shows board + draft + accept/edit/reject flow. Approved blocks written to canonical catalog.
- [ ] Anthropic / OpenAI SDK call goes through the existing repertoire-build entrypoint. No LangChain (Article 3). No agent loop (Article 4 doesn't apply — this is offline build, not a runtime feature).
- [ ] Open-source license check: any auxiliary library added is permissive (Article 1). Update `tech.md` if anything new lands.

### Out of scope this phase
- Bulk authoring across all 25 lines × 15 openings. Gold + batch *infrastructure* only. One full opening's worth of approved content as proof.

---

## R5 — Quality gates

### Acceptance criteria

- [ ] Tests: `useExplainMode` state machine covered (start, advance, pause, prev, restart, skip, completion). Targets ≥10 cases.
- [ ] Tests: schema validator rejects malformed `explain` blocks at build time.
- [ ] Wife re-test on the gold-authored Italian line (Sat cadence). Passes if she can describe *why* one of the moves was played without prompting after one Explain run.
- [ ] No regression: drill mode unchanged. Existing 94 tests still pass.
- [ ] Build size budget: +12kB gzip cap for the mode shell + overlay components combined. Authoring scripts ship outside the bundle.
- [ ] Type discipline: TS strict, no `any` (Article 14).

---

## Files touched (forecast)

- `src/components/drill/DrillPage.tsx` — header toggle, mode router
- `src/hooks/useExplainMode.ts` — new
- `src/components/explain/ExplainRail.tsx` — new (rationale text + threats)
- `src/components/board/ArrowLayer.tsx` — new or reused if Phase 1.5 ships first
- `src/components/board/HighlightLayer.tsx` — reused (Article 15)
- `src/types/catalog.ts` — `ExplainBlock` + `MoveNode.explain?`
- `scripts/build_explain.py` — new
- `scripts/review_explain.py` — new
- `data/explain/italian-game-main.json` — gold reference content
- `specs/phase-1b-explain-mode/authoring.md` — new (separate doc)
- `tests/explain/*` — state machine + schema validator coverage

---

## Open questions

1. **Where do `explain` blocks live in storage?** Inline in catalog JSON (single source of truth, larger bundle) vs sidecar files (`data/explain/<lineId>.json`, lazy-loaded per line). Lean: sidecar — keeps base catalog small, lazy-load on Explain Mode entry.
2. **TTS later or never?** Cheap accessibility win, but battery drain on mobile and voice quality issues. Defer to 1b.3.
3. **Skip-to-drill mid-line — preserve drill SRS state?** If user skips at ply 6, drill starts from ply 0 (current behavior) or ply 6? Lean: ply 0, simpler, matches drill semantics.
4. **Rationale length policing.** Hard cap of N characters or soft? Risk: GPT verbose drafts overflow rail. Lean: 280-char hard cap per `rationale`, validator enforced.

---

## Timebox

- Spec + design: 1 weekend half-day (this).
- R1 + R2 + R3 + tests: 1 weekend day.
- R4 (gold-author + batch script + review CLI): 1 weekend day.
- Wife re-test + polish: 1 weekend half-day.

Total: 3 weekend days. If overrun by 50%, cut R4 batch script — ship gold-authored Italian line only and re-spec batch separately. Article 13 holds: pauses immediately if main plan slips.
