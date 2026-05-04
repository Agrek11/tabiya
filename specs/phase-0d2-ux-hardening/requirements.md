# Phase 0d.2 — UX Hardening Requirements

**Trigger:** First non-self user (wife) tested 0d.1 on 2026-05-03. 7 friction points surfaced.

**Scope split:**
- This phase (0d.2): items 1, 2, 5, 6 from real-user list — drill UX hardening + sound fix + customization
- Phase 0d.3 (separate): items 3, 4 — catalog family grouping + gambits

This doc covers 0d.2 only. 0d.3 has its own spec.

**In scope today (Mon May 4 office hours, ≤4 hr cap):**
- R1. Sound bug fix
- R2. Move list collapse + next-move highlight

**Deferred to Sat May 9 (still in 0d.2 scope, separate sitting):**
- R3. Board/piece theme customization
- R4. Tick/cross position + flow polish
- R5. Status strip dedicated component
- R6. Two-tier hint UX
- R7. Board-flip animation

---

## R1 — Sound bug fix

### Symptom
Move sounds not audible during drill (correct, wrong, opponent auto-play, step forward). Reported by user 2026-05-04. Worked at Phase 0a, broken now.

### Hypothesis (no browser test yet)
Code path inspection: `playMove()` calls present in `useDrill` at all expected sites. `unlockAudio()` wired to `<div onPointerDown>` in `ChessBoardPanel`. Module-level `audioEl` singleton.

Likely culprits, ranked:
1. **Unlock gesture missed** — user navigates to `/drill` via Sidebar click; gesture happens BEFORE board mount. If Sidebar event uses `preventDefault` or audio singleton not yet created, unlock never fires. **HIGHEST LIKELIHOOD.**
2. **Concurrent play overlap** — single audio element. Rapid moves (player → flash → opponent auto-play within 800ms) re-call `play()` on already-playing element → some moves swallowed.
3. **Browser-specific autoplay policy** — Chrome/Safari treat module-init `new Audio()` differently. First `play()` after page load may need a SECOND user gesture.
4. **Audio file 404** — unlikely, file exists in `public/sounds/Move.mp3`, but prod build may have different base path.

### Acceptance criteria

- [ ] Move sound plays on every move event: player correct, player wrong, opponent auto-play, step forward, restart no-op (silent OK)
- [ ] Sound plays on first move after page load (no "second click" requirement)
- [ ] Sound does not require pointer-down on the board specifically — any user gesture on the page unlocks
- [ ] Rapid move sequences (player + opponent within 500ms) do not swallow the second sound
- [ ] Settings page has sound toggle (on/off) and volume slider (0–100%, persisted to localStorage)
- [ ] No console errors on autoplay-blocked browsers
- [ ] Existing tests pass

### Technical approach

1. **Global unlock listener.** Replace board-only `onPointerDown={unlockAudio}` with a window-level listener (`document.addEventListener('pointerdown', unlockAudio, { once: true })`) registered at App mount. Triggers on FIRST gesture anywhere — Sidebar, TopBar, dropdown, board. Removes self after firing.
2. **Audio pool.** Replace single `audioEl` with a small pool (3 elements, round-robin index). Each `playMove()` advances index. Eliminates concurrent-play stomp.
3. **Volume + mute respected.** `playMove()` reads from `soundSettings` module (volume %, muted bool, persisted). Default volume 85%, unmuted.
4. **Settings UI.** Add to `SettingsPage`:
   - Toggle: "Sound effects" (on/off)
   - Slider: "Volume" (0–100, disabled when muted)
   - "Test sound" button → fires `playMove()` once

### Files touched

- `src/sound/sounds.ts` — pool refactor, settings hook, global unlock
- `src/main.tsx` OR `src/App.tsx` — register unlock listener at mount
- `src/pages/SettingsPage.tsx` — add sound section
- `tests/sound.test.ts` (NEW) — pool round-robin, mute, volume
- `src/ui/ChessBoardPanel.tsx` — remove redundant `onPointerDown` (global handles it)

---

## R2 — Move list collapse + next-move highlight

### Symptoms
- Right-rail move history takes 280px width permanently. On smaller laptops, board shrinks. User wants ability to hide.
- During drill, hard to tell at glance which move is "next expected." Currently only "current ply" is highlighted with `t.brandSoft` background. Next ply has no visual cue.

### Acceptance criteria

- [ ] Right-rail has collapse toggle (chevron button on rail header)
- [ ] Collapsed state: rail hidden, board area expands to fill freed grid space
- [ ] Expanded state: rail visible at 280px (current behavior)
- [ ] Toggle preference persisted to localStorage (`tabiya.moveRailCollapsed`), survives reload
- [ ] During active drill (state.kind === 'awaiting_player'), next-expected ply has visual accent: underline + theme accent color, distinct from current-ply background highlight
- [ ] Next-move accent renders only when rail is expanded (no point if hidden)
- [ ] Next-move accent does NOT show on `complete`, `wrong_pending`, `flash_correct`, `auto_playing` states (only `awaiting_player`)
- [ ] Existing drill tests still pass
- [ ] New tests: collapse toggle, persistence, next-move accent renders correct ply

### Technical approach

1. **Collapse state hook.** Custom hook `useMoveRailCollapsed()` reads/writes `localStorage`, returns `[collapsed, setCollapsed]`.
2. **DrillPage layout grid.** Switch `gridTemplateColumns` between `'1fr 280px'` (expanded) and `'1fr'` (collapsed) based on hook state.
3. **Rail header chevron.** `ChevronLeft` / `ChevronRight` from lucide-react. Click toggles. Aria-label.
4. **MoveHistory component delta.** Accept `nextIdx?: number` prop. When provided AND rail expanded, render that ply with accent style: `borderBottom: '2px solid t.brand', color: t.brand`.
5. **DrillPage computes nextIdx.** Read from `state.lineIndex` when `state.kind === 'awaiting_player'`. Pass to `MoveHistory`. Else pass `undefined`.
6. **Collapsed render.** Even when rail collapsed, render a thin floating "expand" button on the right edge (24px wide pill) so user can re-open without going to settings.

### Files touched

- `src/pages/DrillPage.tsx` — grid logic, collapse state, expand button, nextIdx prop wiring
- `src/drill/use-move-rail-collapsed.ts` (NEW) — localStorage hook
- `tests/drill-page.test.tsx` — extend with rail collapse + next-move tests
- `tests/use-move-rail-collapsed.test.ts` (NEW) — hook unit tests

---

## R3–R7 — Deferred (Sat May 9)

Specs deferred. Rough notes for Saturday:

- **R3 board/piece customization:** 6 board themes (lichess-classic, blue, green, brown, wood, marble) + 4 piece sets (cburnett, alpha, merida, kosal). Settings dropdowns. Drill TopBar quick-toggle. localStorage. Wire via `react-chessboard` `customPieces` + `lightSquareStyle`/`darkSquareStyle`.
- **R4 tick/cross position:** Move from corner overlay to dedicated below-board status strip OR animate-fade after 800ms. Don't obscure piece state.
- **R5 status strip:** Dedicated component between board and rail. Shows: line name, ply X of Y, drill state, accuracy this session.
- **R6 hint two-tier:** First H press = highlight piece (subtle pulse). Second H press = full from-square highlight (current behavior).
- **R7 board flip:** 300ms CSS transition on orientation change.

---

## Out of scope this phase

- Family grouping in repertoire (Phase 0d.3)
- Gambits section (Phase 0d.3)
- AI features (Phase 2 + 4)
- SRS data layer (Phase 1)
