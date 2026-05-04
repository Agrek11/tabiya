# Phase 0d.2 — Implementation Tasks

## Today (Mon May 4 office hours, ≤4 hr cap)

### T1 — Sound module v2 + global unlock
- [ ] Refactor `src/sound/sounds.ts`: pool of 3 audio elements, round-robin, settings (muted+volume) read from localStorage, `__resetSoundForTests` export
- [ ] Wire global unlock listener in `src/App.tsx` (pointerdown + keydown, `once: true, capture: true`)
- [ ] Remove `onPointerDown={unlockAudio}` from `src/ui/ChessBoardPanel.tsx`
- [ ] Write `tests/sound.test.ts` — pool round-robin, mute, volume, unlock idempotent, settings persistence
- [ ] Existing tests still pass

### T2 — Settings page sound section
- [ ] Add Sound card to `src/pages/SettingsPage.tsx`: toggle, volume slider, test button
- [ ] Wire to `getSettings()`/`writeSettings()` from sound module
- [ ] Manually verify slider+toggle update behavior in dev server

### T3 — Move rail collapse hook
- [ ] Create `src/drill/use-move-rail-collapsed.ts`
- [ ] Write `tests/use-move-rail-collapsed.test.ts`

### T4 — DrillPage rail collapse + next-move accent
- [ ] Wire `useMoveRailCollapsed()` in `DrillPage`
- [ ] Switch grid columns based on collapsed state
- [ ] Add chevron-collapse button in rail header
- [ ] Add floating "Show moves" expand pill when collapsed
- [ ] Compute `nextIdx` from drill state (awaiting_player only), pass to `MoveHistory`
- [ ] Add next-move accent styling in `MoveHistory` td

### T5 — Tests + verify
- [ ] Run `npm test` — all green
- [ ] Run `npm run dev` — manual smoke test in browser:
  - sound plays on first move
  - rapid moves no swallow
  - settings persist
  - rail collapse/expand
  - next-move accent

## Saturday May 9 (post-SRS-anchor parallel work)

### T6–T10 — Deferred items (R3–R7 from requirements)
- T6: Board theme + piece set picker (Settings + Drill quick-toggle)
- T7: Tick/cross relocation or fade
- T8: Status strip dedicated component
- T9: Two-tier hint UX
- T10: Board flip animation

Specs to be written Saturday morning before implementation.
