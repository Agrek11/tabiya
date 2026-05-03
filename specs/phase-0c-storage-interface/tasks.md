# Tasks: Phase 0c — Storage Interface + Catalog-Driven Drill

All tasks complete. Run order at the bottom.

## 1. Storage Layer
- [x] **1.1** `src/storage/types.ts` — `OpeningRepository` interface + DTOs (Opening, Line, KeySquare, Catalog, SearchQuery)
- [x] **1.2** `src/storage/JsonOpeningRepository.ts` — fetch + cache + 5 query methods + lightweight schema validator
- [x] **1.3** `src/storage/index.ts` — singleton `getRepository()` + test-only setter

## 2. UI Layer
- [x] **2.1** `src/ui/OpeningPicker.tsx` — opening dropdown
- [x] **2.2** `src/ui/LinePicker.tsx` — line dropdown
- [x] **2.3** `src/ui/DrillView.tsx` — load catalog, render pickers, drive drill with selected line
- [x] **2.4** `src/drill/useDrill.ts` — reset chess+state when line prop changes (so picking new line restarts drill)

## 3. Tests
- [x] **3.1** `tests/json-opening-repository.test.ts` — 17 cases: all 5 query methods, caching, fetch failure, HTTP error, schema-validation failures
- [x] **3.2** `tests/drill-view.test.tsx` — render test: loading state → ready state with picker; error state when repo throws

## 4. Verification (you on Mac)
- [ ] **4.1** `npm run test` — expect 28 (Phase 0a) + 17 (repo) + 2 (DrillView) = 47 frontend tests
- [ ] **4.2** `npm run dev` — open localhost:5173, see opening dropdown + line dropdown, drill starts on first line
- [ ] **4.3** Switch opening → board resets, new line plays
- [ ] **4.4** Complete a line → confetti + 2.2s pause + drill restarts from move 0
- [ ] **4.5** `npm run build` — bundle still under 600 KB gzipped
- [ ] **4.6** `docker compose up` — same flow at localhost:8080

## 5. Commit
- [ ] **5.1** `git add src/storage src/ui tests/json-opening-repository.test.ts tests/drill-view.test.tsx specs/phase-0c-storage-interface`
- [ ] **5.2** `git commit -m "feat: phase-0c — repository interface + catalog-driven drill with opening/line pickers"`
- [ ] **5.3** `git tag v0.3-phase-0c`
- [ ] **5.4** `git push && git push --tags`

## Run Commands

```sh
npm run test       # all frontend tests
npm run dev        # open localhost:5173, drive the picker UI
npm run build      # production bundle check
docker compose up  # parity check
```

## Exit Criteria

- All frontend tests green
- Picker UI operational; opening + line selection drives the drill
- Complete-on-line still triggers confetti + auto-restart
- No consumer outside `src/storage/` imports `JsonOpeningRepository` directly
- `v0.3-phase-0c` tagged + pushed
