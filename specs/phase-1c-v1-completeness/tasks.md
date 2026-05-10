# Tasks: Phase 1c — V1 Completeness

Sequential checklist. References R# (requirements) and design sections (D§).

Estimate: 4-5h hands-on. Order minimizes coupling.

## 1. Tier 2 content (R4) — independent foundation

- [ ] 1.1 Add 14 Tier 2 variations to `scripts/curated/variations.yml` per D§4 table
- [ ] 1.2 Add 14 Tier 2 lines to `scripts/curated/lines.yml` (1 main line per variation, 12-18 ply, ≥1 strategic_note each)
- [ ] 1.3 Rebuild catalog: `uv run python -m scripts.build_catalog --source curated-v2`
- [ ] 1.4 Verify: 30 families × 40 variations × ~52 lines, no Article 8 failures

## 2. Drill queue routing (R1) — closes Phase 1 loop

- [ ] 2.1 Add `queueState` local state in DrillPage with the 3-variant union from D§1
- [ ] 2.2 On mount: read `?queue=due`, snapshot `useSRS().dueLineIds`, set queueState
- [ ] 2.3 Wire complete → next-in-queue effect (gated by queueState.kind === 'active')
- [ ] 2.4 Wire user-picker → exit queue (set queueState to 'off')
- [ ] 2.5 Render queue indicator badge "QUEUE N/M" in header
- [ ] 2.6 Render `kind === 'exhausted'` state with "All caught up" + Dashboard CTA
- [ ] 2.7 Update Dashboard "Drill N due" CTA to confirm `/drill?queue=due` works
- [ ] 2.8 Test: integration test driving queue exhaustion

## 3. Strategic notes panel (R2)

- [ ] 3.1 Create `src/ui/StrategicNotesPanel.tsx` — collapsible, persisted via localStorage
- [ ] 3.2 Wire into DrillPage layout (above move history rail or below board)
- [ ] 3.3 Empty-state caption when `notes.length === 0`
- [ ] 3.4 Test: render with notes, render empty, toggle collapse persists

## 4. Fork annotation rendering (R3)

- [ ] 4.1 Create `src/ui/ForkBadge.tsx` — small `⋔` button
- [ ] 4.2 Create `src/ui/ForkPopover.tsx` — list alternatives + label + rationale
- [ ] 4.3 Pass `forks: ForkAnnotation[]` from `activeLine` to `MoveHistoryGrid`
- [ ] 4.4 Decorate cells in MoveHistoryGrid where `f.ply_index === idx`
- [ ] 4.5 Click handler opens popover; outside-click closes via `useClickOutside`
- [ ] 4.6 Test: render line with forks, click badge, see alternatives

## 5. End-of-line summary (R6)

- [ ] 5.1 Create `src/ui/EndOfLineSummary.tsx` — card with line name, ply count, counters, mastery delta, notes, CTAs
- [ ] 5.2 Compute mastery delta: prev SrsState (captured before drill) vs current
- [ ] 5.3 Wire prev-state capture in DrillPage: snapshot SrsState at drill start
- [ ] 5.4 Render summary when `state.kind === 'complete'` AND `queueState.kind !== 'active'`
- [ ] 5.5 CTAs: Restart (calls drill.restart), Drill due (navigate `/drill?queue=due`), Next in family (find next line)
- [ ] 5.6 Test: summary renders correct values; queue mode skips it

## 6. Repertoire presets (R5)

- [ ] 6.1 Create `scripts/curated/presets.yml` per D§5 schema
- [ ] 6.2 Add `Preset` type to `src/storage/types.ts`
- [ ] 6.3 Add `presets: Preset[]` field to `Catalog` schema (Pydantic + TS), back-compat optional
- [ ] 6.4 Update `curated_v2_builder.py` to load presets.yml and emit
- [ ] 6.5 `OpeningRepository.listPresets(): Promise<Preset[]>` + `getPreset(id)` + `JsonOpeningRepository` impl
- [ ] 6.6 Create `src/hooks/usePreset.ts` — read/write localStorage `tabiya.repertoirePreset`
- [ ] 6.7 Add Settings card "Preset repertoires" — radio options
- [ ] 6.8 Filter RepertoirePage families by active preset (when not 'custom')
- [ ] 6.9 Filter DrillPage opening-picker families likewise
- [ ] 6.10 Tests: preset filter applied / Off restores all

## 7. Per-line SRS reset (R7)

- [ ] 7.1 Create `src/ui/LineActionsMenu.tsx` — `⋮` icon + popover with "Reset SRS"
- [ ] 7.2 Wire into RepertoirePage line row (multi-line variations + single-line)
- [ ] 7.3 onReset → `getSrsRepository().resetState(line.id)` + `useSRS().refresh()`
- [ ] 7.4 Disabled when no SrsState for line
- [ ] 7.5 Test: click reset → state cleared

## 8. Wife re-test intake doc (R10)

- [ ] 8.1 Write `specs/ux-intake-2026-05-10-priya.md` skeleton

## 9. Final verification

- [ ] 9.1 Full TS test suite green
- [ ] 9.2 Full Python test suite green
- [ ] 9.3 `npx tsc -b` no NEW errors beyond baseline 4
- [ ] 9.4 Manual smoke: dashboard "Drill N due" → queue mode → all-caught-up
- [ ] 9.5 Manual smoke: select Beginner preset → Repertoire shows 3 families only
- [ ] 9.6 Manual smoke: complete a line → summary screen renders mastery delta

## 10. Docs + commit

- [ ] 10.1 Update `features.md` (presets, queue, summary, forks, tier 2)
- [ ] 10.2 Update obsidian `tabiya.md` Implementation Status (Phase 1c → ✅ shipped)
- [ ] 10.3 Update memory session log
- [ ] 10.4 Commit + tag `v0.7-phase-1c` + push

## Out of scope (verify by absence)

- [ ] No transposition layer (Phase 2 prep)
- [ ] No RepertoirePick layer (Phase 1.5)
- [ ] No game import / Lichess sync (Phase 3)
- [ ] No AI Coach (Phase 4)
