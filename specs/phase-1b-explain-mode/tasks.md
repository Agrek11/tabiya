# Tasks: Phase 1b — Explain Mode

Parallel-friendly task graph. Each task = one focused agent session. Tasks with the same `BlockedBy` value run in parallel. Requirements R1-R7 and design sections referenced inline.

Strategy: types + schema land first (everyone downstream needs them), then schema validator + sidecar fetcher + state machine fan out in parallel, then UI surfaces (toggle, rail, overlays) compose them, authoring pipeline runs independently of UI work, and tests close out alongside their subjects.

---

## Implementation Tasks

### Phase 1: Setup

- [ ] **Task 1.1**: Add Anthropic SDK + Jinja2 to Python build deps
  - **ID**: `task-1.1`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `pyproject.toml`
  - **Change**: Add `anthropic` and `jinja2` under build/script dependencies. Run `uv lock`. Update `tech.md` allowed-deps table with both packages (Apache-2 / BSD-3) per Constitution Article 1.
  - **Outcome**: `uv run python -c "import anthropic, jinja2"` succeeds; `tech.md` lists both packages with licenses; lockfile committed.
  - **Context**: Requirement R4 criteria 5-6; design §6 (Anthropic SDK call), §10 (Article 1). Authoring scripts only — these deps never ship in the frontend bundle (Article 16).

- [ ] **Task 1.2**: Add `tabiya:flag:explainTts` to feature-flag registry
  - **ID**: `task-1.2`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `src/storage/featureFlags.ts` (or current flag registry; create if absent)
  - **Change**: Register `explainTts` flag, default `false`, with typed accessor `getExplainTtsFlag()` / `setExplainTtsFlag(v: boolean)`. Mirror localStorage key `tabiya:flag:explainTts`.
  - **Outcome**: Single source of truth for the TTS flag, typed read/write, no string literals leaking into hooks.
  - **Context**: Requirement R6 criterion 1; design §7 (storage keys table). Article 14 (no `any`).

- [ ] **Task 1.3**: Confirm `tsconfig.json` strict mode + add `public/explain/` to `.gitignore`
  - **ID**: `task-1.3`
  - **BlockedBy**: `none`
  - **Agent**: `general-purpose`
  - **File**: `.gitignore`
  - **Change**: Append `public/explain/` (build output). Verify `tsconfig.json` has `"strict": true` and `"noImplicitAny": true` (no edit if already set).
  - **Outcome**: `public/explain/*.json` is regeneratable build output, not source. Strict TS holds.
  - **Context**: Requirement R5 criterion 6; design §3 (sidecar file layout), §10 (Article 14).

### Phase 2: Schema + Sidecar Loader (R2)

- [ ] **Task 2.1**: Add `ExplainBlock`, `Arrow`, `HighlightSquare`, `Line.explain?`, `Catalog.schema_version` to TS types
  - **ID**: `task-2.1`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `src/storage/types.ts`
  - **Change**: Add `ArrowColor`, `Arrow`, `HighlightSquare`, `ExplainBlock` types verbatim from design §2. Widen `Line` with optional `explain?: ExplainBlock[]` (same length as `moves` when present). Add `schema_version: number` to `Catalog`. Re-export new types from `src/storage/index.ts`.
  - **Outcome**: `npx tsc --noEmit` passes with no new errors; new types importable across the codebase.
  - **Context**: Requirement R2 criteria 1, 3, 5; design §2 (TypeScript additions). No runtime impact — types only. Article 14 — no `any`.

- [ ] **Task 2.2**: Add pydantic mirrors `Arrow`, `HighlightSquare`, `ExplainBlock`, `ExplainSidecar` + `Catalog.schema_version`
  - **ID**: `task-2.2`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/tabiya_build/schema.py`
  - **Change**: Add pydantic models exactly as design §2 specifies, including `from_` aliased to `from` for `Arrow`, length-2 square strings, optional `intent` literals, `pause_ms` bounds `[500, 20000]`. Add `schema_version: int = 2` to `Catalog`.
  - **Outcome**: `uv run python -c "from scripts.tabiya_build.schema import ExplainSidecar; ExplainSidecar(...)"` round-trips a fixture. Backwards compatible — existing catalog still loads.
  - **Context**: Requirement R2 criteria 2, 3; design §2 (Python additions). Article 14 — Python type hints on public functions.

- [ ] **Task 2.3**: Implement `validate_explain.py` — sidecar validator
  - **ID**: `task-2.3`
  - **BlockedBy**: `task-2.2`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/tabiya_build/validate_explain.py`
  - **Change**: Function `validate_all_explain_sidecars(data_dir: Path, catalog: Catalog) -> None`. For each `data/explain/*.json` (excluding `pending/`, `rejected/`): load `ExplainSidecar`, look up line by `line_id`, assert `len(blocks) == len(line.moves)` strict, regex-check every square (`^[a-h][1-8]$`), assert `schema_version == catalog.schema_version`. Raise `ExplainValidationError` with structured message on failure. Provide CLI entry `uv run python -m scripts.tabiya_build.validate_explain <line_id>` for single-line check.
  - **Outcome**: Build fails loudly with actionable error on any malformed sidecar; passes silently when clean.
  - **Context**: Requirement R2 criterion 2 + R5 criterion 2; design §2 (Validation gates). Article 6 — sidecar keyed on `line_id`.

- [ ] **Task 2.4**: Wire validator + `copy_explain_to_public` into `build_catalog.py`
  - **ID**: `task-2.4`
  - **BlockedBy**: `task-2.3`
  - **Agent**: `general-purpose`
  - **File**: `scripts/build_catalog.py`
  - **Change**: After `write_catalog(catalog)`, call `validate_all_explain_sidecars(Path("data/explain"), catalog)`, then `copy_explain_to_public(src=Path("data/explain"), dst=Path("public/explain"))` (copies non-pending sidecars only). Add `--skip-explain` CLI flag for catalog-only rebuilds.
  - **Outcome**: `uv run python scripts/build_catalog.py` produces `public/explain/<id>.json` for every approved sidecar; fails the build on malformed content.
  - **Context**: Requirement R2 criterion 2 + R4 criterion 1; design §3 (file layout) + §6 (Build integration).

- [ ] **Task 2.5**: Implement `useExplainContent(lineId)` lazy-load hook
  - **ID**: `task-2.5`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useExplainContent.ts`
  - **Change**: Implement `useExplainContent(lineId: string | null): ExplainContentState` with state union `idle | loading | loaded | missing | error`. In-module `Map<string, ExplainBlock[] | 'missing'>` cache. `fetch(`/explain/${lineId}.json`)` with `AbortController`; abort on `lineId` change or unmount. On 200: validate `blocks.length === activeLine.moves.length` (accept `moves.length` via second optional argument for runtime safety); on 404: cache `'missing'`; on other errors: emit `'error'` without caching. No localStorage caching — static asset HTTP cache is enough.
  - **Outcome**: Toggle visibility logic in `DrillPage` can consume a typed state machine; missing sidecars degrade silently; network errors are recoverable on retry.
  - **Context**: Requirement R1 criterion 4 + R2; design §3 (Fetcher + Graceful degrade). Article 5 — encapsulates sidecar I/O so future backend serving is a one-hook swap. Article 11 — local-first; static asset.

### Phase 3: State Machine + Rail (R3, R7)

- [ ] **Task 3.1**: Implement `useExplainMode` state machine + timer
  - **ID**: `task-3.1`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useExplainMode.ts`
  - **Change**: Implement the reducer with states `idle | showOverlays | playingMove | awaiting_next | complete` and actions `ENTER | PAUSE_MS_ELAPSED | MOVE_PLAYED | AUTO_ADVANCE | PAUSE | RESUME | NEXT | PREV | RESTART | SKIP`. Single `setTimeout` ref with `setT(ms, action)` / `clearT()` helpers. Own one chess.js instance like `useDrill`; on `PREV` call `chess.undo()`, on `MOVE_PLAYED` call `chess.move(san)`, on `RESTART` call `chess.reset()`. 300ms post-move beat between `playingMove → awaiting_next → showOverlays(next)`. Pause captures `pausedAt` ms remaining; resume schedules remaining. Cleanup `clearT()` on unmount. Return `UseExplainModeReturn` shape from design §4.
  - **Outcome**: Pure, testable hook with deterministic transitions. Reducer stays pure; side effects (`setTimeout`, `chess.move`) live in `useEffect` driven by state.
  - **Context**: Requirement R3 criteria 2-5; design §4 (state machine + timer handling + chess.js handling). Article 7 — linear lines only; one chess instance, no fork. Article 14 — strict TS.

- [ ] **Task 3.2**: Implement `useExplainTts(args)` Web Speech wrapper
  - **ID**: `task-3.2`
  - **BlockedBy**: `task-1.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useExplainTts.ts`
  - **Change**: Implement `useExplainTts({ lineId, paused }): { speak, cancel, available, enabled, toggleLineMute }`. `available` = capability detection of `window.speechSynthesis` + `SpeechSynthesisUtterance`. `enabled` = global flag AND not per-line muted (`tabiya:linePrefs:<lineId>:ttsMute`). `speak(text)` calls `cancel()` first, then creates a new `SpeechSynthesisUtterance` and `speechSynthesis.speak(u)`. No-op when `!available || !enabled || paused || text.length === 0`. Voice/rate/pitch deferred to 1b.3 — browser defaults only.
  - **Outcome**: TTS is a thin, swappable hook. Older browsers no-op silently. Per-line mute toggles independently of global flag.
  - **Context**: Requirement R6 criteria 1-4, 7; design §7. Article 11 — Web Speech API is browser-native, no network.

- [ ] **Task 3.3**: Implement `<TruncatedText>` primitive
  - **ID**: `task-3.3`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/ui/explain/TruncatedText.tsx`
  - **Change**: Implement `<TruncatedText text limit={280} />` as design §5. If `text.length <= limit` render plain `<span>`. Otherwise render truncated + ellipsis + `show more` / `show less` toggle. Component-local `useState` for `expanded`. No external state. Reset behavior emerges from parent passing `key={ply}` to remount.
  - **Outcome**: Reusable truncation primitive used twice in `<ExplainRail>` (rationale + threats), with no shared toggle state.
  - **Context**: Requirement R7 criteria 1-2, 4; design §5 (TruncatedText). Article 14.

- [ ] **Task 3.4**: Implement `<ExplainRail>` component
  - **ID**: `task-3.4`
  - **BlockedBy**: `task-3.1, task-3.3`
  - **Agent**: `chief-programmer`
  - **File**: `src/ui/explain/ExplainRail.tsx`
  - **Change**: Render the rail as design §5 sketch: title `Ply N — <Color>: <SAN>`, `<TruncatedText>` for rationale, `<TruncatedText>` for threats (only if present, collapsible heading), control buttons (`Prev`, `Pause`/`Resume`, `Next`, `Restart`, `Skip to drill`). Props from design §5. Pure presentational — all state via props. Speaker icon (`🔊`/`🔇`) only when global TTS flag is on (consume via prop `ttsEnabledGlobal: boolean` + `ttsMutedForLine: boolean` + `onToggleLineMute: () => void`).
  - **Outcome**: Stateless rail driven entirely by hook output; trivial to snapshot-test.
  - **Context**: Requirement R3 criterion 4 + R7 + R6 criterion 3; design §5. Sticky on tall scrolls.

- [ ] **Task 3.5**: Implement `<ArrowLayer>` SVG overlay primitive
  - **ID**: `task-3.5`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `chief-programmer`
  - **File**: `src/ui/board/ArrowLayer.tsx`
  - **Change**: SVG overlay sized to the board panel. One `<line>` per arrow with `marker-end` arrowhead. Color per `arrow.color` (default `green`). Coordinates from the existing `getSquarePixel(square, isFlipped, boardSize)` helper used by `KeySquareOverlay` (locate via grep before implementing). Reads board flip state from `<ChessBoardPanel>` context if present; otherwise accept `isFlipped` prop. Empty arrows array renders an empty `<svg>` (size budget — no DOM churn).
  - **Outcome**: New overlay primitive that composes with `<HighlightLayer>` under the existing `<ChessBoardPanel>` overlay slot. ≈1.5 KB gzip.
  - **Context**: Requirement R3 criterion 1; design §5 (Overlay coordination). Article 15 — sibling primitive to `HighlightLayer`, not a fork.

- [ ] **Task 3.6**: Confirm or evolve `<HighlightLayer>` to accept `intent` styling
  - **ID**: `task-3.6`
  - **BlockedBy**: `task-2.1`
  - **Agent**: `Explore`
  - **File**: `src/ui/board/HighlightLayer.tsx`
  - **Change**: Locate existing `KeySquareOverlay`. If `<HighlightLayer>` is the same file/component, add `intent?: 'focus' | 'threat' | 'support'` styling branch (CSS class hook) without breaking Phase 1.5 callers. If it's a separate component, rename / consolidate so a single primitive serves both Pattern Viz and Explain. Document the consolidation in a 1-line code comment referencing Article 15.
  - **Outcome**: Single highlight primitive consumed by both Pattern Viz (Phase 1.5) and Explain Mode. No forked second implementation.
  - **Context**: Requirement R3 criterion 1; design §5 (overlay table). Article 15 (single primitive).

- [ ] **Task 3.7**: Implement `<ExplainView>` composition
  - **ID**: `task-3.7`
  - **BlockedBy**: `task-3.1, task-3.2, task-3.4, task-3.5, task-3.6`
  - **Agent**: `chief-programmer`
  - **File**: `src/ui/explain/ExplainView.tsx`
  - **Change**: Compose `useExplainMode(line, blocks)` + `useExplainTts({ lineId, paused })`. Render `<ChessBoardPanel>` with `<HighlightLayer>` and `<ArrowLayer>` siblings, clearing both arrays when `state.kind !== 'showOverlays'`. Render `<ExplainRail key={state.lineIndex} block={...} ply={...} ... />` (remount-on-ply for truncate reset). Reuse the drill `<ProgressBar>` — same component. On `state.kind === 'complete'` render `<EndOfLineSummary drillResult={null} onDrillThisLine={onSkipToDrill} />`. Effect: when entering `showOverlays`, call `tts.speak(block.rationale)`; when `paused` flips true, call `tts.cancel()`; on unmount call `tts.cancel()`. Accept `onSkipToDrill: () => void` callback for the parent to flip mode.
  - **Outcome**: Single composition root for Explain Mode; all hooks wired; overlays toggle in lockstep with state; TTS lifecycle hooked into state transitions.
  - **Context**: Requirement R3 criteria 1, 2, 6 + R6 criteria 2, 4; design §4 (Skip semantics) + §5 (Overlay coordination) + §7 (Wiring into useExplainMode). Article 11 + 15.

### Phase 4: Mode Toggle + Routing (R1)

- [ ] **Task 4.1**: Implement `useLinePrefMode(lineId)` localStorage hook
  - **ID**: `task-4.1`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `src/hooks/useLinePrefMode.ts`
  - **Change**: `useLinePrefMode(lineId: string | null): ['drill' | 'explain', (mode: 'drill' | 'explain') => void]`. Read `tabiya:linePrefs:<lineId>:mode` on `lineId` change; write on set. Default `'drill'`. SSR-safe (`typeof window` guard). No effect when `lineId === null`.
  - **Outcome**: Toggle persists per line independently; switching lines preserves each line's chosen mode.
  - **Context**: Requirement R1 criterion 2; design §1 (Per-line persistence). Article 11.

- [ ] **Task 4.2**: Implement `<ModeToggle>` segmented control
  - **ID**: `task-4.2`
  - **BlockedBy**: `none`
  - **Agent**: `chief-programmer`
  - **File**: `src/ui/ModeToggle.tsx`
  - **Change**: Two-state pill `[ Drill │ Explain ]`. Props: `value: 'drill' | 'explain'`, `onChange(mode)`, `disabled?: boolean`. Match existing header picker styles (read `OpeningPicker` / `LinePicker` for visual conventions). Keyboard-accessible (arrow keys to switch, Enter to commit; `role="tablist"`).
  - **Outcome**: Drop-in segmented control matching the v1.3 header pill style.
  - **Context**: Requirement R1 criterion 1; design §1 (Placement). Article 14.

- [ ] **Task 4.3**: Wire `DrillPage` to route between `<DrillView>` and `<ExplainView>`
  - **ID**: `task-4.3`
  - **BlockedBy**: `task-2.5, task-3.7, task-4.1, task-4.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/pages/DrillPage.tsx`
  - **Change**: Add `useLinePrefMode(activeLineId)` and `useExplainContent(activeLineId)`. Visibility: hide `<ModeToggle>` when `explain.kind === 'missing' | 'idle' | 'error'`; render disabled while `loading`; enabled when `loaded`. Mount `<DrillView key={`drill-${activeLineId}`} />` or `<ExplainView key={`explain-${activeLineId}`} blocks={explain.data} onSkipToDrill={() => setMode('drill')} />` based on `mode`. The differing keys force unmount-on-mode-change so chess.js instances do not leak across modes. Sidebar nav untouched.
  - **Outcome**: Toggle appears only when explain content is available; flipping mode resets the board to ply 0; sidebar entry unchanged (Repertoire-grid only).
  - **Context**: Requirement R1 criteria 1, 3, 4, 5; design §1 (Mode switch semantics + Component sketch). Article 5 — `OpeningRepository` untouched.

### Phase 5: Authoring Pipeline (R4)

- [ ] **Task 5.1**: Write authoring schema doc
  - **ID**: `task-5.1`
  - **BlockedBy**: `task-2.2`
  - **Agent**: `general-purpose`
  - **File**: `specs/phase-1b-explain-mode/authoring.md`
  - **Change**: Document the `ExplainSidecar` JSON shape with annotated example, length-must-match-moves rule, arrow color semantics (green=planned, red=threat-prevented, blue=coordination), highlight intent semantics, when to set `pauseMs`, beginner-rationale style guide (1-3 sentences, no engine eval scores, name pieces by descriptive role). Reference the gold Italian sidecar as canonical example.
  - **Outcome**: Standalone doc usable by both LLM prompts and human reviewers; eliminates ambiguity in `review_explain.py` edit flow.
  - **Context**: Requirement R4 criterion 2; design §6 (prompt template constraints).

- [ ] **Task 5.2**: Author gold Italian Game sidecar
  - **ID**: `task-5.2`
  - **BlockedBy**: `task-2.3, task-5.1`
  - **Agent**: `general-purpose`
  - **File**: `data/explain/italian-game-main.json`
  - **Change**: Hand-write ~10-12 ply of `ExplainBlock` content for the Italian Game main line. One block per ply, length matches the catalog line. Each block: 1-3 sentence rationale, 1-2 arrows (green for the move played), 1-3 highlights (focus on contested squares). Threats only where instructive (Fried Liver alarm at the right ply). `pauseMs` default unless a critical move warrants extra dwell.
  - **Outcome**: Validator passes (`uv run python -m scripts.tabiya_build.validate_explain italian-game-main`). One full gold line ready for runtime use and as few-shot fodder.
  - **Context**: Requirement R4 criterion 1 + R5 criterion 3 (wife re-test target). Article 8 (≤20 ply, gold target ~10-12).

- [ ] **Task 5.3**: Build `scripts/build_explain.py` prompt + SDK call
  - **ID**: `task-5.3`
  - **BlockedBy**: `task-2.2, task-5.1, task-5.2`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/build_explain.py`
  - **Change**: CLI flags: `--line-id`, `--opening`, `--gold-path` (default `data/explain/italian-game-main.json`), `--out-dir` (default `data/explain/pending/`), `--copy-to-public` (separate utility mode). For build mode: load line from catalog, build per-ply context `(fen_before, san, fen_after, piece_moved)`, load gold blocks (truncated to first 6 plies for cost), render Jinja2 template `specs/phase-1b-explain-mode/prompts/build_explain.j2`, call Anthropic SDK directly with `cache_control: { type: "ephemeral" }` on the few-shot block, parse JSON response into `ExplainSidecar`, write `data/explain/pending/<line_id>.json`. No LangChain.
  - **Outcome**: Single command `uv run python scripts/build_explain.py --line-id ruy-lopez-closed-main --opening "Ruy Lopez"` produces a pending sidecar draft.
  - **Context**: Requirement R4 criteria 3, 5; design §6 (build_explain.py architecture + Anthropic SDK call). Article 3 — no LangChain. Article 1 — anthropic + jinja2 already declared.

- [ ] **Task 5.4**: Build `specs/phase-1b-explain-mode/prompts/build_explain.j2`
  - **ID**: `task-5.4`
  - **BlockedBy**: `task-5.1`
  - **Agent**: `general-purpose`
  - **File**: `specs/phase-1b-explain-mode/prompts/build_explain.j2`
  - **Change**: Jinja2 template per design §6 (System + Few-shot + User sections). Strict JSON output constraint, ExplainBlock schema inlined, arrow/highlight semantics from authoring.md, gold blocks injected via `{{ gold_blocks_truncated }}`, per-ply context loop with `{{ ply.index }}. {{ ply.san }}` and `FEN after: {{ ply.fen_after }}`.
  - **Outcome**: Prompt produces strict JSON parseable by `ExplainSidecar` on first call for typical openings.
  - **Context**: Requirement R4 criterion 3; design §6 (Prompt template).

- [ ] **Task 5.5**: Build `scripts/review_explain.py` CLI
  - **ID**: `task-5.5`
  - **BlockedBy**: `task-2.3, task-5.3`
  - **Agent**: `chief-programmer`
  - **File**: `scripts/review_explain.py`
  - **Change**: Text TUI. CLI flag `--line <line_id>`. Loop over blocks in `data/explain/pending/<line_id>.json`. For each: print `chess.Board.unicode()` rendering, rationale, arrows, highlights, threats, pauseMs. Read single-char input: `a` accept, `e` edit (open `$EDITOR` on a temp JSON snippet, re-validate on close), `r` reject (mark null, blocks final save), `s` skip-to-next, `q` quit-save. On all-accepted: prompt to write to `data/explain/<line_id>.json`, run validator synchronously, delete pending file. On partial: write back to pending with edits preserved.
  - **Outcome**: Reviewer can walk an LLM-drafted line in <2 min/ply and ship approved content with confidence.
  - **Context**: Requirement R4 criterion 4; design §6 (review_explain.py CLI flow). No new runtime deps — `python-chess` and stdlib only.

### Phase 6: TTS Settings UI (R6)

- [ ] **Task 6.1**: Add "Explain Mode" section to SettingsPage
  - **ID**: `task-6.1`
  - **BlockedBy**: `task-1.2, task-3.2`
  - **Agent**: `chief-programmer`
  - **File**: `src/pages/SettingsPage.tsx`
  - **Change**: New section "Explain Mode" with a single checkbox bound to `tabiya:flag:explainTts`. Caption: "Uses your browser's built-in voice. No network." When `useExplainTts({lineId:null,paused:false}).available === false`, render checkbox disabled with caption "Your browser does not support speech synthesis."
  - **Outcome**: User can flip the global TTS flag from Settings; UI gracefully reflects browser capability.
  - **Context**: Requirement R6 criteria 1, 7; design §7 (Settings UI placement). Article 11.

### Phase 7: Tests + Size Budget (R5)

- [ ] **Task 7.1**: Tests for `useExplainMode` state machine (≥12 cases)
  - **ID**: `task-7.1`
  - **BlockedBy**: `task-3.1`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/explain/useExplainMode.test.ts`
  - **Change**: Cover all 12 cases from design §8: initial state, `PAUSE_MS_ELAPSED` advance, `MOVE_PLAYED` advance, `AUTO_ADVANCE` at last ply → complete, `NEXT` skip, `PREV` undo, `PAUSE`+`RESUME` preserves remaining timer, `RESTART` resets chess + state, `SKIP` emits `complete` with `skipped: true`, per-ply `pauseMs` override honored, unmount clears timer (no leaked dispatch), empty blocks array → immediate complete. Use `vi.useFakeTimers()` for timer tests. Coverage gate: 100% line + branch on `useExplainMode.ts`.
  - **Outcome**: State machine bug-free under all transition paths.
  - **Context**: Requirement R5 criterion 1; design §8 (test cases). Article 14.

- [ ] **Task 7.2**: Tests for `useExplainContent` lazy-loader
  - **ID**: `task-7.2`
  - **BlockedBy**: `task-2.5`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/explain/useExplainContent.test.ts`
  - **Change**: Mock `fetch`. Cover: 200 with valid blocks → `loaded`, 404 → `missing`, network error → `error` (no cache write so retry possible), abort on `lineId` change, cache hit returns synchronously, length-mismatch 200 → treated as `missing` with console.warn.
  - **Outcome**: Fetcher behavior locked under all network paths.
  - **Context**: Requirement R2 + R5; design §3 (Graceful degrade).

- [ ] **Task 7.3**: Tests for `useExplainTts`
  - **ID**: `task-7.3`
  - **BlockedBy**: `task-3.2`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/explain/useExplainTts.test.ts`
  - **Change**: Mock `window.speechSynthesis` + `SpeechSynthesisUtterance`. Cover: `speak` no-ops when flag off, no-ops when per-line muted, calls `speechSynthesis.cancel()` before each `speak`, no-op when `paused`, returns `available: false` when speechSynthesis undefined (with `delete (window as any).speechSynthesis` in test), `toggleLineMute` writes localStorage.
  - **Outcome**: TTS lifecycle correct; older-browser path is a true no-op.
  - **Context**: Requirement R6 criteria 2, 3, 4, 7; design §7.

- [ ] **Task 7.4**: Tests for `<ExplainRail>` + `<TruncatedText>`
  - **ID**: `task-7.4`
  - **BlockedBy**: `task-3.3, task-3.4`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/explain/ExplainRail.test.tsx`
  - **Change**: `<TruncatedText>` boundary cases: text length 279/280/281 with limit 280; toggle expands; remount with new `key` resets to truncated. `<ExplainRail>`: Prev/Next/Pause/Restart/Skip buttons fire callbacks; `canPrev=false` disables Prev; `paused=true` flips button label to "Resume"; threats hidden when null; speaker icon only when `ttsEnabledGlobal=true`.
  - **Outcome**: Rail rendering + truncation invariants pinned.
  - **Context**: Requirement R7 criteria 1, 2, 4 + R3 criterion 4; design §5.

- [ ] **Task 7.5**: Tests for `<ModeToggle>` + DrillPage integration
  - **ID**: `task-7.5`
  - **BlockedBy**: `task-4.3`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/explain/ModeToggle.test.tsx`
  - **Change**: `<ModeToggle>` visibility cases: hidden when content `missing`, disabled when `loading`, enabled when `loaded`. Keyboard nav (arrow keys + Enter). DrillPage integration: switching mode mid-line resets board to ply 0 (assert by checking the unmount of the old view's `key`). Per-line persistence: drill line A in explain, switch to line B in drill, return to A → still explain (localStorage round-trip).
  - **Outcome**: Toggle behavior + mode-switch reset semantics locked.
  - **Context**: Requirement R1 criteria 1, 2, 3, 4; design §1.

- [ ] **Task 7.6**: Tests for `<ArrowLayer>`
  - **ID**: `task-7.6`
  - **BlockedBy**: `task-3.5`
  - **Agent**: `testability-reviewer`
  - **File**: `tests/explain/ArrowLayer.test.tsx`
  - **Change**: Empty arrows → empty `<svg>`. Single arrow renders one `<line>` with `marker-end`. Board flipped → coordinates inverted (mock `getSquarePixel` and assert call args). Color prop honored (`green` default, `red`, `blue`).
  - **Outcome**: New overlay primitive correct under flip + color permutations.
  - **Context**: Requirement R3 criterion 1; design §5. Article 15.

- [ ] **Task 7.7**: Python tests — schema validator
  - **ID**: `task-7.7`
  - **BlockedBy**: `task-2.3`
  - **Agent**: `testability-reviewer`
  - **File**: `scripts/tests/test_validate_explain.py`
  - **Change**: Cover from design §8: valid sidecar passes; `len(blocks) != len(moves)` fails with clear error; bad square `"e9"` fails; missing `rationale` fails; `pause_ms` out of bounds fails; `schema_version` mismatch fails. Use pytest tmp_path for fixtures.
  - **Outcome**: Build-time validator pinned; future schema changes can't silently regress.
  - **Context**: Requirement R5 criterion 2; design §8 (validator tests).

- [ ] **Task 7.8**: Python tests — build_explain prompt + JSON parse
  - **ID**: `task-7.8`
  - **BlockedBy**: `task-5.3, task-5.4`
  - **Agent**: `testability-reviewer`
  - **File**: `scripts/tests/test_build_explain.py`
  - **Change**: Mock Anthropic SDK client. Cover: prompt renders with all required Jinja2 variables; gold blocks truncation works; SDK response round-trips into `ExplainSidecar` (golden fixture); malformed JSON response raises clear error; `--copy-to-public` mode copies only non-pending sidecars.
  - **Outcome**: Authoring pipeline regression-locked without consuming live LLM quota.
  - **Context**: Requirement R4 criteria 3, 5; design §6.

- [ ] **Task 7.9**: Build-size budget check script
  - **ID**: `task-7.9`
  - **BlockedBy**: `task-3.7, task-4.3, task-6.1`
  - **Agent**: `general-purpose`
  - **File**: `scripts/check-explain-size.js`
  - **Change**: After `vite build`, diff `dist/assets/*.js.gz` total against a baseline committed in `scripts/explain-baseline.txt`. Assert delta ≤ 12288 bytes (12 KB) gzip. Warn at delta > 9.6 KB (80%). Fail when delta > 12 KB. Add `npm run build:size` to `package.json` scripts that runs `vite build` + this check. Allow `--update-baseline` flag for explicit baseline rebases.
  - **Outcome**: Build-size budget enforced in CI; accidental dep bloat surfaces immediately.
  - **Context**: Requirement R5 criterion 5; design §9 (size analysis).

- [ ] **Task 7.10**: Create wife-retest manual gate doc
  - **ID**: `task-7.10`
  - **BlockedBy**: `task-5.2`
  - **Agent**: `general-purpose`
  - **File**: `specs/phase-1b-explain-mode/wife-retest.md`
  - **Change**: Skeleton doc with: date, line drilled (Italian Game main), pass criterion (can describe *why* one move was played without prompting after one Explain run), observations log, outcome (pass/fail), follow-ups.
  - **Outcome**: Manual gate has a record; later phases can reference past pedagogy outcomes.
  - **Context**: Requirement R5 criterion 3 (Sat cadence). Article 13 (weekend pace).

- [ ] **Task 7.11**: Regression smoke — drill unchanged + tsc + full suite
  - **ID**: `task-7.11`
  - **BlockedBy**: `task-7.1, task-7.2, task-7.3, task-7.4, task-7.5, task-7.6, task-7.7, task-7.8, task-7.9`
  - **Agent**: `general-purpose`
  - **File**: `tests/` (no file; full-suite run)
  - **Change**: Run `npm test -- --run` (assert all suites green, ≥ existing 94 + new). Run `npx tsc --noEmit` (no new TS errors). Run `uv run pytest` (assert Python suite green). Run `npm run build:size` (assert ≤12 KB gzip delta). Run `npm run dev`, drill the Italian gold line in Drill mode → assert no behavior change vs. main; switch to Explain mode → assert autoplay loop works end-to-end; click Skip to drill → assert drill starts at ply 0.
  - **Outcome**: Phase 1b ready to ship with no drill regressions and budgets honored.
  - **Context**: Requirement R5 criteria 4, 5, 6; design §8 + §9. Article 13 (cut R4 batch script if overrun).

---

## Dependency Diagram

```
                            ┌────────────┐
                            │ Phase 1    │
                            │ Setup      │
                            │ 1.1 1.2 1.3│  (all parallel, BlockedBy=none)
                            └─────┬──────┘
                                  │
            ┌─────────────────────┼─────────────────────────────────────┐
            ▼                     ▼                                     ▼
     ┌──────────┐          ┌──────────┐                          ┌──────────┐
     │ 2.1 TS   │          │ 2.2 py   │                          │ 4.1 hook │
     │ types    │          │ schema   │                          │ 4.2 togg │
     └────┬─────┘          └────┬─────┘                          └────┬─────┘
          │                     │                                     │
          │                     ▼                                     │
          │              ┌──────────┐                                 │
          │              │ 2.3 valid│ ─► 2.4 wire build               │
          │              └────┬─────┘                                 │
          │                   │                                       │
          ├─────► 2.5 fetch   │                                       │
          ├─────► 3.1 state ──┤                                       │
          ├─────► 3.3 trunc   │                                       │
          ├─────► 3.5 arrows  │                                       │
          ├─────► 3.6 highlts │                                       │
          │                   │                                       │
          ▼                   ▼                                       │
   ┌──────────┐        ┌──────────┐                                   │
   │ 3.2 tts  │◄───── 1.2                                             │
   └────┬─────┘                                                       │
        │                                                             │
        │     ┌──── 3.4 rail (◄ 3.1, 3.3)                             │
        │     │                                                       │
        ▼     ▼                                                       │
   ┌─────────────┐                                                    │
   │ 3.7 view    │ (◄ 3.1, 3.2, 3.4, 3.5, 3.6)                        │
   └──────┬──────┘                                                    │
          │                                                           │
          └─────────────────┬────── 4.3 DrillPage router ◄── 2.5,3.7,4.1,4.2
                            │
                            │   ┌────────────┐
                            │   │ Phase 5    │ (parallel branch — authoring)
                            │   │ Pipeline   │
                            │   └────────────┘
                            │     5.1 doc (◄ 2.2)
                            │     5.2 gold (◄ 2.3, 5.1)
                            │     5.4 prompt (◄ 5.1)
                            │     5.3 build  (◄ 2.2, 5.1, 5.2)
                            │     5.5 review (◄ 2.3, 5.3)
                            │
                            │     6.1 settings TTS (◄ 1.2, 3.2)
                            │
                            ▼
              ┌──────────────────────────────┐
              │ Phase 7: Tests + Budget       │
              │ 7.1 ◄ 3.1                     │
              │ 7.2 ◄ 2.5                     │
              │ 7.3 ◄ 3.2                     │
              │ 7.4 ◄ 3.3, 3.4                │
              │ 7.5 ◄ 4.3                     │
              │ 7.6 ◄ 3.5                     │
              │ 7.7 ◄ 2.3                     │
              │ 7.8 ◄ 5.3, 5.4                │
              │ 7.9 ◄ 3.7, 4.3, 6.1           │
              │ 7.10 ◄ 5.2                    │
              └────────────────┬──────────────┘
                               ▼
                      ┌────────────────┐
                      │ 7.11 smoke     │ (◄ 7.1..7.9)
                      └────────────────┘
```

**Parallel opportunities (max fan-out groups):**

- Wave 1 (3 parallel, BlockedBy=`none`): `1.1`, `1.2`, `1.3`, plus `2.1`, `2.2`, `4.1`, `4.2` — 7 tasks runnable on day 1.
- Wave 2 (after `2.1` + `2.2`): `2.3`, `2.5`, `3.1`, `3.3`, `3.5`, `3.6`, `5.1` — 7 tasks parallel.
- Wave 3 (after `1.2`, `3.1`, `3.3`): `3.2`, `3.4`, plus `5.2` (after `2.3`+`5.1`) and `5.4` (after `5.1`) — 4 tasks parallel.
- Wave 4 (after `3.2`, `3.4`, `3.5`, `3.6`): `3.7`, `5.3` (after `5.2`), `6.1` (after `3.2`), `7.1`, `7.2`, `7.3`, `7.6`, `7.7`, `7.10` — 9 tasks parallel.
- Wave 5: `4.3`, `5.5`, `7.4`, `7.8` — 4 tasks parallel.
- Wave 6: `7.5`, `7.9` — 2 tasks parallel.
- Wave 7: `7.11` smoke — terminal.

**Critical path** (longest dependency chain):

```
1.2 → 2.2 → 2.3 → 5.1 → 5.2 → 5.3 → 7.8 → 7.11
                                            │
                  2.1 → 3.1 → 3.4 → 3.7 → 4.3 → 7.5 ─► 7.11
                                            │
                  3.1 → 7.1 ────────────────┴────────► 7.11
                                            │
                  3.7 → 7.9 ─────────────────────────► 7.11
```

The two longest chains: `1.2 → 2.2 → 2.3 → 5.1 → 5.2 → 5.3 → 7.8 → 7.11` (8 hops, authoring path) and `2.1 → 3.1 → 3.4 → 3.7 → 4.3 → 7.5 → 7.11` (7 hops, UI path). Either dominates. If R4 batch script gets cut per Article 13 (weekend pace overflow), the authoring path collapses to `2.1 → 2.3 → 5.2 → 7.10` and the UI path becomes critical.

---

## Completion Criteria

Phase 1b is done when:

1. **All 7 requirements covered**: R1 (mode toggle), R2 (schema + sidecar), R3 (state machine + autoplay), R4 (authoring + gold line), R5 (quality gates), R6 (TTS feature flag), R7 (rationale truncation) — every acceptance criterion checked.
2. **Test suite green**: `npm test -- --run` passes with ≥10 `useExplainMode` cases (achieves 12); existing 94+ tests still pass; Python `uv run pytest` green; coverage 100% on `useExplainMode.ts` and `validate_explain.py`.
3. **Type discipline holds**: `npx tsc --noEmit` zero new errors beyond pre-existing baseline; no `any` introduced; `ruff check` green on new Python files (Article 14).
4. **Size budget honored**: `npm run build:size` reports delta ≤ 12 KB gzip vs. baseline (R5 criterion 5; design §9).
5. **Gold content shipped**: `data/explain/italian-game-main.json` validates and is served at `public/explain/italian-game-main.json` after build.
6. **Authoring pipeline functional**: `uv run python scripts/build_explain.py --line-id <id> --opening <name>` produces a valid pending draft; `scripts/review_explain.py --line <id>` walks blocks interactively and writes to `data/explain/`.
7. **Constitution compliance**: Articles 1, 3, 5, 6, 7, 8, 11, 13, 14, 15, 16 each verified in design §10 still hold against the shipped code. Specifically:
   - Article 1: `anthropic` + `jinja2` declared in `tech.md` with licenses.
   - Article 3: zero LangChain / agent-framework imports in `scripts/build_explain.py`.
   - Article 5: zero direct imports of sidecar fetcher implementation outside `src/hooks/`.
   - Article 15: single `<HighlightLayer>` primitive used by both Pattern Viz and Explain Mode.
   - Article 16: `public/explain/*.json` shipped as static asset in the nginx image; `docker compose up frontend` works offline.
8. **Manual wife re-test**: `specs/phase-1b-explain-mode/wife-retest.md` records a Pass on the Italian gold line (R5 criterion 3).
9. **Regression smoke clean**: Drill mode is byte-for-byte unchanged from the user's perspective; switching to Explain on a sidecarless line keeps the toggle hidden; Skip-to-drill always lands at ply 0.
10. **Cut-line discipline**: if weekend cadence overflows, R4 batch script (`scripts/build_explain.py`) is the only deletable scope per Article 13. Gold-authored Italian line ships regardless.

---

## Summary

- **Total tasks**: 30 across 7 phases.
- **Total phases**: 7 (Setup → Schema/Sidecar → State Machine/Rail → Mode Toggle → Authoring Pipeline → TTS Settings → Tests/Budget).
- **Parallel opportunities**: 7 waves; peak wave (Wave 4) runs 9 tasks in parallel. Wave 1 starts 7 tasks immediately with no prerequisites.
- **Critical path**: 7-8 hops depending on whether the authoring branch dominates. UI path: `2.1 → 3.1 → 3.4 → 3.7 → 4.3 → 7.5 → 7.11`. Authoring path: `2.2 → 2.3 → 5.1 → 5.2 → 5.3 → 7.8 → 7.11`.
- **Cut-line if weekend overruns** (Article 13): drop `task-5.3`, `task-5.4`, `task-5.5`, `task-7.8` (the LLM batch authoring + review CLI). Ship gold-authored Italian line + full UI + tests. Re-spec batch separately.
