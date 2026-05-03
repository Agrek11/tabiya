# Tasks: Phase 0a — Skeleton

Implementation checklist. Tasks sequenced bottom-up: scaffold → pure logic → UI → containerization → verify. Each task lists requirements + design sections it satisfies.

Estimate: 1 weekend (~6-8 hrs).

## 1. Project Scaffold

- [x] **1.1** Run `npm create vite@latest . -- --template react-ts` in repo root
  *(Req 1.2, 1.3 · AD1)*
- [x] **1.2** Verify generated `package.json`, install deps with `npm install`
  *(Req 1.1 · Article 1)*
- [x] **1.3** Enable strict mode in `tsconfig.json` — `strict: true`, `noUncheckedIndexedAccess: true`
  *(Req 1.4 · Article 14) — Vite scaffold ships both ON by default*
- [x] **1.4** Add `eslint` + `prettier` (or `biome`) configs; wire `npm run lint` script
  *(Req 1.5 · Article 14) — `eslint.config.js` shipped; `npm run lint` script present; removed stray duplicate from devDependencies*
- [x] **1.5** Verify `npm run dev` starts Vite, `npm run build` produces `dist/`, `npm run preview` serves the build
  *(Req 1.2, 1.3) — verified on Mac*
- [ ] **1.6** Delete unused vite defaults (`App.css`, sample logo CSS, counter component) to keep LOC budget tight
  *(Req 7.1) — deferred until app code lands (section 5)*
- [x] **1.7** Add `.gitignore` with `node_modules/`, `dist/`, `.DS_Store`, `*.log`, `.env*`
  *(Vite scaffold provided most; added `.env*` block for secrets hygiene)*

## 2. Install Project Dependencies

- [x] **2.1** `npm install react-chessboard chess.js`
  *(Req 2.1, 2.2 · Articles 1, 9) — added to `package.json` dependencies; chess.js@1.4.0, react-chessboard@5.10.0*
- [x] **2.2** `npm install --save-dev vitest @testing-library/react jsdom`
  *(Req 7.3) — added to devDependencies; vitest@^4.1.5, @testing-library/react@^16.3.2, jsdom@^29.1.1*
- [x] **2.3** Verify each new dep license is MIT / Apache-2 / BSD / ISC; record in `tech.md` if missing
  *(Article 1) — react-chessboard MIT, chess.js BSD-2-Clause, vitest MIT, @testing-library/react MIT, jsdom MIT — all already declared in tech.md*
- [x] **2.4** Pin all deps to `major.minor` (no `^` for chess libs) to avoid silent API breaks
  *(Risk: react-chessboard API churn) — chess.js and react-chessboard pinned to exact version (no `^`); dev tooling allowed `^` since they're build-time only*

## 3. Drill Logic (Pure)

- [ ] **3.1** Create `src/drill/sample-line.ts` exporting `SAMPLE_LINE_SAN` and `SAMPLE_LINE_NAME`
  *(Req 3.1 · Articles 9, 10)*
- [ ] **3.2** Create `src/drill/move-comparator.ts` with `compareMove(chess, expectedSan, attempt)` returning `{kind: 'correct'|'wrong'|'illegal'}`
  *(Req 3.3, 3.6 · Article 9 · AD3, AD5)*
- [ ] **3.3** Add canonicalization helper that round-trips each SAN in the line through chess.js once at module load to normalize form (handles `O-O` vs `0-0`, disambiguation)
  *(Risk: SAN form mismatch)*

## 4. Drill Hook (`useDrill`)

- [ ] **4.1** Create `src/drill/useDrill.ts` with discriminated-union `DrillState` type
  *(Design — state machine)*
- [ ] **4.2** Implement reducer for events `PLAYER_MOVE_ATTEMPTED`, `FLASH_TIMER_DONE`, `AUTO_PLAY_TIMER_DONE`
  *(Req 3.3-3.7, 4.1-4.4 · Design transitions)*
- [ ] **4.3** Wire `setTimeout(400)` for flash states and `setTimeout(300)` for auto-play, with `useEffect` cleanup
  *(Req 4.1, 4.2 · Req 3.4)*
- [ ] **4.4** On enter `awaiting_player` with first move being White, dispatch auto-play immediately so White's first move appears on the board
  *(Req 3.2)*
- [ ] **4.5** Wrong moves do NOT mutate chess.js (AD8) — board snaps back via re-render
  *(Req 4.3 · Design AD8)*
- [ ] **4.6** Expose to `DrillView`: `{ state, fen, squareStyles, statusText, onPieceDrop }`

## 5. UI Components

- [ ] **5.1** Create `src/ui/StatusBar.tsx` — pure presentational, takes `text: string` prop
  *(Req 4.4)*
- [ ] **5.2** Create `src/ui/ChessBoardPanel.tsx` — wraps `<Chessboard>`, accepts `position` (FEN), `customSquareStyles`, `onPieceDrop` props
  *(Req 2.1, 2.3, 2.4 · Article 9 boundary conversion)*
- [ ] **5.3** Set board width 480px desktop, responsive on mobile (CSS clamp or media query)
  *(Req 2.3)*
- [ ] **5.4** Set board orientation White by default
  *(Req 2.4)*
- [ ] **5.5** Create `src/ui/DrillView.tsx` — calls `useDrill()`, renders `<ChessBoardPanel />` and `<StatusBar />`
  *(Design — composition)*
- [ ] **5.6** Update `src/App.tsx` to render only `<DrillView />`
- [ ] **5.7** Update `src/index.css` with minimal body reset + center the drill view; remove default vite styles
  *(Req 7.1 — LOC discipline)*

## 6. Tests

- [ ] **6.1** Configure `vitest` in `vite.config.ts` with `test: { environment: 'jsdom' }`
  *(Req 7.3)*
- [ ] **6.2** Create `tests/move-comparator.test.ts` with three cases: correct / wrong / illegal
  *(Req 7.3 · Design test snippet)*
- [ ] **6.3** Verify `npm run test` passes
  *(Req 7.3)*
- [ ] **6.4** Add `npm run test` to `package.json` scripts if not auto-generated

## 7. Containerization

- [ ] **7.1** Create `docker/frontend.Dockerfile` per design (multi-stage, `node:20.11-alpine` builder, `nginx:1.27-alpine` runtime)
  *(Req 6.1, 6.5 · Article 16)*
- [ ] **7.2** Create `docker/nginx.conf` with SPA fallback `try_files`
  *(Design)*
- [ ] **7.3** Create `docker-compose.yml` at repo root, single `frontend` service mapped `8080:80`, image tag `tabiya/frontend:0.1`
  *(Req 6.2, 6.3 · Article 16)*
- [ ] **7.4** Create `.dockerignore` excluding `node_modules`, `dist`, `.git`, `steering`, `ctx`, `specs`, `*.md`
  *(Req 6.6)*
- [ ] **7.5** Run `docker compose build` — verify success
  *(Req 6.3)*
- [ ] **7.6** Run `docker compose up` — verify `http://localhost:8080` renders the drill and accepts moves
  *(Req 6.3, 6.4)*
- [ ] **7.7** Run `docker images tabiya/frontend:0.1 --format '{{.Size}}'` — verify under 50 MB
  *(Req 6.7)*

## 8. Verification (Manual)

- [ ] **8.1** **Acceptance walk Req 2:** `npm run dev`. Confirm board renders with starting position, White perspective, ~480px wide.
- [ ] **8.2** **Acceptance walk Req 3:** Confirm e4 auto-plays. Try e5 → accepted, opponent auto-plays Nf3. Continue Nc6, then opponent Bb5. "Line complete" appears after Bb5.
- [ ] **8.3** **Acceptance walk Req 3 (wrong):** Restart drill, try d5 (legal but wrong reply to e4). Confirm red flash + board unchanged + "Wrong — try again".
- [ ] **8.4** **Acceptance walk Req 3 (illegal):** Try e2→e5 (illegal — pawn 3-square). Confirm board unchanged, no flash, no error.
- [ ] **8.5** **Acceptance walk Req 4:** Confirm green flash on correct, red flash on wrong, both ~400ms.
- [ ] **8.6** **Acceptance walk Req 5:** Kill network in DevTools, reload, drill still works. Grep src/ for "chess.com" / "lichess" / "abhi" / "agrek" — none.
- [ ] **8.7** **Acceptance walk Req 6:** `docker compose up` → browser at 8080 → walk Req 3 again to confirm parity with `npm run dev`.
- [ ] **8.8** **Acceptance walk Req 7.1:** `cloc src/` (or `wc -l src/**/*.{ts,tsx}`) — confirm under ~400 LOC hand-written.
- [ ] **8.9** **Acceptance walk Req 7.2:** Lighthouse or DevTools — confirm interactive board < 2s cold cache.
- [ ] **8.10** **Acceptance walk Req 7.4:** `npm run build && du -sh dist/` + gzip sizes via `vite build --report` plugin or DevTools — confirm < 500 KB gzipped.
- [ ] **8.11** **Acceptance walk Req 7.5:** Smoke in Chrome + Firefox + Safari (or webkit preview). No polyfill warnings.

## 9. Documentation

- [ ] **9.1** Update root `README.md` "Getting Started" section: prerequisites (Node 20+ OR Docker), `npm install && npm run dev`, `docker compose up`
- [ ] **9.2** Add `npm run` script reference to README (dev, build, preview, test, lint)
- [ ] **9.3** Confirm `package.json` `license` field matches `LICENSE` file
  *(Article 1)*

## 10. Commit + Wrap

- [ ] **10.1** First commit: `feat: phase-0a skeleton — Vite + React + chess.js + drill v0`
- [ ] **10.2** Second commit: `feat: phase-0a docker compose — nginx serving static dist`
- [ ] **10.3** Push to remote (create remote if missing)
- [ ] **10.4** Tag `v0.1-phase-0a` on `main` head as milestone marker

## Compliance Self-Check (run before closing spec)

- [ ] No proprietary deps; every dep license declared *(Article 1)*
- [ ] No Node backend; no Python yet; no polyglot drift *(Article 2)*
- [ ] No LangChain / CrewAI *(Article 3)*
- [ ] Article 4 N/A — no AI features in this phase
- [ ] Articles 5-8 N/A — no catalog data layer in this phase
- [ ] All chess data in SAN format *(Article 9)*
- [ ] No author identity or chess.com/lichess username strings *(Article 10)*
- [ ] No required network calls *(Article 11)*
- [ ] No backend introduced *(Article 12)*
- [ ] Shipped within one weekend *(Article 13)*
- [ ] TypeScript strict on; lint passes *(Article 14)*
- [ ] No highlight forking — single square-style primitive *(Article 15)*
- [ ] `docker compose up` works and is the canonical run command *(Article 16)*

## Exit Criteria

Phase 0a is DONE when:

1. `npm run dev` → board renders, drill works (manual walk 8.1-8.5)
2. `npm run test` → green
3. `docker compose up` → same drill at `localhost:8080` (walk 8.7)
4. Bundle < 500 KB gzipped, image < 50 MB compressed, source < 400 LOC
5. README has Getting Started section with both run paths
6. Compliance self-check above is fully ticked
7. Two commits pushed + `v0.1-phase-0a` tag

After exit: open Phase 0b spec (`/spec:create phase-0b-catalog-build`) for the Python catalog pipeline.
