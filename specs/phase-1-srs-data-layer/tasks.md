# Tasks: Phase 1 — SRS Data Layer

Sequential checklist. Tasks reference Requirement (R#) and Architectural Decision (D#) numbers from this spec's `requirements.md` and `design.md`.

Estimate: 1-2 weekends (~8-12 hrs hands-on).

Strategy: ship the pure scheduler + InMemory repo + tests FIRST (no browser dep). Then layer IDB persistence, then UI surfaces, then drill integration last so the UI tier is exercising real data end-to-end on the smoke run.

## 1. Project Setup

- [ ] **1.1** Add `idb` to `package.json` dependencies (`npm install idb`) (D1)
- [ ] **1.2** Add `fake-indexeddb` to `devDependencies` for IDB integration tests (`npm install -D fake-indexeddb`) (Testing approach)
- [ ] **1.3** Verify ISC license on `idb` package; record in `tech.md` allowed deps (Constitution Article 1)
- [ ] **1.4** Confirm `tsconfig.json` strict mode unchanged (Article 14)

## 2. Types + Constants

- [ ] **2.1** Add `SrsState`, `DrillResult`, `BOX_INTERVALS_DAYS`, `SrsRepository` interface to `src/storage/types.ts` (R1.2 · D §3)
- [ ] **2.2** Re-export new types from `src/storage/index.ts` barrel (R4.4)
- [ ] **2.3** Type-check passes: `npx tsc --noEmit` no new errors

## 3. Pure Scheduler (`src/storage/srs/scheduler.ts`)

- [ ] **3.1** Create `src/storage/srs/scheduler.ts`
- [ ] **3.2** Implement `nextSrsState(prev: SrsState | null, result: DrillResult, now?: Date): SrsState` (R3.1-R3.6 · D §3)
- [ ] **3.3** Implement `isDue(state: SrsState, now: Date): boolean` using `BOX_INTERVALS_DAYS` (R2.2)
- [ ] **3.4** Implement `masteryPercent(state: SrsState | null): number` mapping {null:0, 1:20, 2:40, 3:60, 4:80, 5:100} (R7.1, R7.2)
- [ ] **3.5** Implement `aggregateMasteryByOpening(states, lines): Map<openingId, number>` (R7.3)
- [ ] **3.6** Implement `aggregateMasteryByFamily(perOpening, families): Map<familyId, number>` (R7.4)
- [ ] **3.7** Defensive: clamp out-of-band `box` values 1-5 inside `nextSrsState` if prev is corrupt (D §5 error table)

## 4. Scheduler Tests

- [ ] **4.1** Create `tests/srs-scheduler.test.ts`
- [ ] **4.2** Matrix tests: `nextSrsState(null, {wrong: w})` for w ∈ {0, 1, 2, 3, 4, 10} → expect Box 2 if w<3 else Box 1 (R3.5)
- [ ] **4.3** Matrix tests: `nextSrsState({box: N, ...}, {wrong: w})` for N ∈ {1..5} × w ∈ {0, 1, 2, 3, 5} (R3.1-R3.3)
- [ ] **4.4** Cap test: Box 5 + 0 wrong stays at Box 5 (no Box 6) (R3.1)
- [ ] **4.5** Floor test: Box 1 + 5 wrong stays at Box 1 (no Box 0) (R3.3)
- [ ] **4.6** Hint-neutral test: `{wrong: 0, hint_uses: 99}` still promotes (R3.4)
- [ ] **4.7** Counters test: `attempts` += 1, `wrong_attempts_total` += result.wrong, `hint_uses_total` += result.hint (R3.6)
- [ ] **4.8** `last_reviewed` test: equals injected clock arg (D §3 — clock injection)
- [ ] **4.9** `isDue` boundary tests: at `last_reviewed + interval - 1ms` → false; at `+ interval` → true (R2.2)
- [ ] **4.10** `masteryPercent` test: all 5 boxes + null
- [ ] **4.11** `aggregateMasteryByOpening` test: openings with mixed drilled / undrilled lines, undrilled counts as 0 per R7.5
- [ ] **4.12** `aggregateMasteryByFamily` test: family rollup over openings, empty family → 0
- [ ] **4.13** Coverage gate: 100% line + branch on scheduler.ts (D §6)

## 5. InMemorySrsRepository

- [ ] **5.1** Create `src/storage/srs/InMemorySrsRepository.ts` implementing `SrsRepository` (D §1, D3)
- [ ] **5.2** Backing store: `private states = new Map<string, SrsState>()`
- [ ] **5.3** `recordDrillResult` calls `scheduler.nextSrsState(prev, result)` and writes to map
- [ ] **5.4** Re-export from `src/storage/index.ts`
- [ ] **5.5** Tests `tests/in-memory-srs-repository.test.ts` — interface contract: empty initial, write-then-read, write-then-update, resetState, resetAll (R11.4 indirectly)

## 6. IndexedDbSrsRepository

- [ ] **6.1** Create `src/storage/srs/IndexedDbSrsRepository.ts` (R1.5 · D §3 schema table)
- [ ] **6.2** DB name `tabiya`, version `1`, store `srs_state`, keyPath `line_id`, index `box` (D §3, D4)
- [ ] **6.3** `openDB()` lazy on first method call; cache the opened DB promise on the instance
- [ ] **6.4** Implement `getState(lineId)`, `listAllStates()`, `recordDrillResult`, `resetState`, `resetAll` (R4.1)
- [ ] **6.5** `recordDrillResult` reads → calls scheduler → writes inside the same IDB transaction OR sequential (sequential acceptable per D §5; document choice in code comment)
- [ ] **6.6** Per-record runtime type guard `isSrsState(raw)` in `listAllStates` to skip corrupt records (D §5 error table)
- [ ] **6.7** Tests `tests/indexeddb-srs-repository.test.ts` using `fake-indexeddb` (R11.3)
- [ ] **6.8** Test: open with no existing DB creates store
- [ ] **6.9** Test: round-trip write → close DB → reopen → read returns same record
- [ ] **6.10** Test: corrupt record skipped, valid records returned (defensive read)
- [ ] **6.11** Test: `resetAll` empties store

## 7. DI Factory Wiring

- [ ] **7.1** Add `getSrsRepository()` and `_setSrsRepositoryForTesting()` to `src/storage/index.ts` (R4.4 · R4.6)
- [ ] **7.2** Default impl: `new IndexedDbSrsRepository()` (R4.2)
- [ ] **7.3** Verify no consumer imports `IndexedDbSrsRepository` directly (R4.5) — `grep -rn "IndexedDbSrsRepository" src/ | grep -v "src/storage/"` returns empty
- [ ] **7.4** Constitution Article 5 audit: type test that `getSrsRepository()` returns `SrsRepository` interface, not concrete class

## 8. useDrill — Per-Drill Counters + DrillResult Emission

- [ ] **8.1** Read current `src/drill/useDrill.ts` to identify reducer state shape
- [ ] **8.2** Add per-drill counters to drill state: `wrong_attempts: number`, `hint_uses: number`, `started_at: string` (R5.5)
- [ ] **8.3** Reducer increments `wrong_attempts` on every WRONG_MOVE action
- [ ] **8.4** Reducer increments `hint_uses` on every HINT_PRESSED action
- [ ] **8.5** Reset counters to zero when transitioning to a new line / restart
- [ ] **8.6** Compute `DrillResult` on complete: `{ wrong_attempts, hint_uses, duration_ms: Date.now() - started_at_ms, completed_at: new Date().toISOString() }` (R5.2)
- [ ] **8.7** Expose `drillResult` field on `useDrill` return value when `state.kind === 'complete'`, else `null`

## 9. DrillPage — recordDrillResult Wiring

- [ ] **9.1** Read current `src/pages/DrillPage.tsx` to identify complete-state render branch
- [ ] **9.2** Add `useEffect` listening on `state.kind === 'complete'` (R5.1)
- [ ] **9.3** Inside effect: call `getSrsRepository().recordDrillResult(activeLine.id, drillResult).catch(err => console.error('SRS write failed:', err))` (D5)
- [ ] **9.4** Use a ref or state flag to ensure exactly one call per complete event (R5.1) — guard against re-renders firing again
- [ ] **9.5** Skip handler does NOT call recordDrillResult (R5.3)
- [ ] **9.6** Drill UI rendering does NOT await the write (D5)

## 10. useSRS Hook

- [ ] **10.1** Create `src/hooks/useSRS.ts` (R6.1)
- [ ] **10.2** Implement load on mount via `listAllStates()` → `Map<string, SrsState>` (R6.2)
- [ ] **10.3** Implement `dueLineIds` derived state via `scheduler.isDue` filter (R6.3)
- [ ] **10.4** Implement `refresh()` callback re-reading from repo (R6.4)
- [ ] **10.5** No timer / polling (R6.5)
- [ ] **10.6** Surface `loading` and `error` states (D §5)
- [ ] **10.7** Tests `tests/use-srs.test.tsx` using `_setSrsRepositoryForTesting(new InMemorySrsRepository())` (R11.4)

## 11. RepertoirePage — Mastery Wiring

- [ ] **11.1** Read current `src/pages/RepertoirePage.tsx` (Phase 0d.3 family-card layout)
- [ ] **11.2** Call `useSRS()` at top of component
- [ ] **11.3** Compute family-level mastery via `aggregateMasteryByFamily(aggregateMasteryByOpening(states, lines), families)` once per states change (memoize)
- [ ] **11.4** FamilyCard: render family mastery percentage + bar above existing opening count (R7.4)
- [ ] **11.5** Inside expanded FamilyCard: render per-opening mastery bar on each opening row (R7.3)
- [ ] **11.6** Per-line mastery (in a future Line list view): leave as `masteryPercent(states.get(line.id))` for trivial lookup
- [ ] **11.7** Empty-state caption preserved when SrsState absent (R7.2 — "Drill to track" / "Not started")
- [ ] **11.8** Extend `tests/repertoire-page.test.tsx` with mastery wiring assertion: line at Box 3 → 60% bar in DOM

## 12. DashboardPage — Real Stats

- [ ] **12.1** Read current `src/pages/DashboardPage.tsx` to find placeholder widgets
- [ ] **12.2** Call `useSRS()` + `getRepository().listOpenings()` / `listLines()` for catalog totals
- [ ] **12.3** Wire "Lines mastered" widget: `count(states where box >= 4) / catalog.lines.length` as % (R8.1)
- [ ] **12.4** Wire "Due for review" widget: `dueLineIds.length` (R8.2)
- [ ] **12.5** Wire "Drill" CTA href: `/drill?queue=due` when `dueLineIds.length > 0`, else current default (R8.3, D6)
- [ ] **12.6** Empty-state branch when `states.size === 0` — point user to RepertoirePage (R8.4)
- [ ] **12.7** Create `tests/dashboard-page.test.tsx` covering: empty state, mastered count, due count, CTA href branching

## 13. Sidebar — Due Badge

- [ ] **13.1** Read current `src/ui/shell/Sidebar.tsx` to find existing "current-streak widget" slot or Repertoire nav item
- [ ] **13.2** Decide: adjacent to Repertoire link OR dedicated slot (one decision; pick whichever requires less restyling)
- [ ] **13.3** Call `useSRS()` (or accept due count as prop) — hook is fine; sidebar already in tree
- [ ] **13.4** Render badge with `dueLineIds.length` when > 0; hide entirely when 0 (R9.1, R9.2)
- [ ] **13.5** No manual refresh trigger needed — hook fires on remount; badge updates next time the user navigates back to a page that re-renders the shell. If staleness is observed in smoke, hoist `useSRS` to a context provider (defer this; document as known limitation if it manifests)
- [ ] **13.6** Test: render Sidebar with mocked SRS state (1 due line) → badge text shows "1"

## 14. SettingsPage — Danger Zone Reset

- [ ] **14.1** Read current `src/pages/SettingsPage.tsx` for section structure
- [ ] **14.2** Add "Danger Zone" section at bottom (visual style: red border / muted heading)
- [ ] **14.3** Add "Reset all SRS progress" button (R10.1)
- [ ] **14.4** On click: open confirmation dialog showing `await getSrsRepository().listAllStates().length` count (R10.2)
- [ ] **14.5** On confirm: `await getSrsRepository().resetAll()` → close dialog → toast or inline success message
- [ ] **14.6** Per-line reset (R10.3) — DEFERRED to Phase 1.5 if no v1 surface exists; document deferral in this task list
- [ ] **14.7** Test: SettingsPage reset flow — click → confirm → assert resetAll called once

## 15. Drill → SRS Integration Test

- [ ] **15.1** Extend `tests/drill-page.test.tsx` with new describe block
- [ ] **15.2** Mock SrsRepository via `_setSrsRepositoryForTesting(new InMemorySrsRepository())`
- [ ] **15.3** Drive drill loop to complete with 0 wrong moves; assert `recordDrillResult` called once with `wrong_attempts: 0` (R5.1, R11.5)
- [ ] **15.4** Drive drill with 2 wrong moves before complete; assert `wrong_attempts: 2` in payload
- [ ] **15.5** Drive drill, click Skip; assert `recordDrillResult` NOT called (R5.3)
- [ ] **15.6** Verify SrsState in InMemory store reflects expected box transition

## 16. Constitution Compliance Audit

- [ ] **16.1** Article 1: only added dep is `idb` (ISC) + `fake-indexeddb` (MIT, dev-only) — record in `tech.md`
- [ ] **16.2** Article 5: grep confirms zero direct imports of `IndexedDbSrsRepository` outside `src/storage/`
- [ ] **16.3** Article 6: SrsState keyed only on `line_id` (no opening_id, no derived fields)
- [ ] **16.4** Article 11: zero network calls in any new code (`grep -rn "fetch\|axios\|httpx" src/storage/srs src/hooks/useSRS.ts` → empty)
- [ ] **16.5** Article 14: no `any` in new TS files; ESLint passes

## 17. Smoke + Manual Verification

- [ ] **17.1** `npm test -- --run` — all suites green, ≥ 100 + Phase 1 additions
- [ ] **17.2** `npx tsc -b` — no NEW errors beyond the 4 pre-existing baseline (DrillPage:166,173 + useDrill:427 + vite.config:8)
- [ ] **17.3** `npm run dev` — drill 1 line in Ruy Lopez completing flawlessly → return to RepertoirePage → mastery bar 40% (Box 2 from clean first attempt) (D §6 smoke)
- [ ] **17.4** DevTools → Application → IndexedDB → tabiya → srs_state — confirm 1 row with `box: 2`
- [ ] **17.5** Drill same line again with 3+ wrong moves → expected: stays at Box 2 since prev was Box 2 and 3+ wrong demotes one (Box 1) — actually this is demote: bar shows 20%, row updated
- [ ] **17.6** Settings → Reset all → confirm → all bars back to 0% / "Drill to track"
- [ ] **17.7** Dashboard reflects real "Lines mastered: 0%" and "Due for review: 0" after reset

## 18. Documentation Updates

- [ ] **18.1** Update `tabiya.md` (obsidian) Implementation Status table: Phase 1 → ✅ shipped + version tag
- [ ] **18.2** Update `features.md`: move SRS items from "NOT DONE" Phase 1 block to ✅ DONE Drill core section
- [ ] **18.3** Update README phase-progress table
- [ ] **18.4** Add 1-line entry to `tech.md` allowed deps: `idb` (ISC)

## 19. Out of Scope (verify by absence)

These intentionally do not appear in the task list and should not slip in mid-phase:

- [ ] **19.1** No `session_events` IDB store (Phase 1.5)
- [ ] **19.2** No heatmap, accuracy %, streak, time-this-week widgets (Phase 1.5)
- [ ] **19.3** No drill-queue routing implementation; URL convention reserved only (D6)
- [ ] **19.4** No multi-tab BroadcastChannel sync (Phase 2+)
- [ ] **19.5** No backend or network call (Article 11)

---

## Suggested execution order (1-2 weekends)

**Sat AM (4-5 hrs):** Sections 1, 2, 3, 4, 5, 6, 7 — pure layer + persistence layer + DI. Ship behind the interface; nothing user-visible yet, but tests prove the engine is correct.

**Sat PM (2-3 hrs):** Sections 8, 9, 15 — drill integration + integration test. After this, drilling actually persists data.

**Sun AM (3-4 hrs):** Sections 10, 11, 12, 13 — UI surfaces light up. Real mastery bars, real Dashboard counts, real Sidebar badge.

**Sun PM (1-2 hrs):** Sections 14, 16, 17, 18 — Settings reset, audit, smoke, docs.

If Sat overruns, defer Section 13 (sidebar) to Sun. The hook-based approach makes the sidebar wiring a 30-min add.
