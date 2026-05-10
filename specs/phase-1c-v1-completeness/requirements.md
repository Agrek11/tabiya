# Requirements: Phase 1c — V1 Completeness

## Introduction

After Phase 0d.3 + Phase 1 + Phase 0d.4 shipped today (2026-05-10), the trainer has working drill, SRS persistence, family/variation hierarchy, and 38 curated lines. **The v1 loop is functional but not coherent** — Dashboard "Drill N due" CTA is theatrical (URL reserved, not consumed); strategic notes sit unused in the catalog; ForkAnnotation richness shipped but invisible at drill time; Tier 2 content is stubbed; no preset repertoire on-ramp; SRS reset is all-or-nothing.

Phase 1c lights up the missing connective tissue + the 1-click on-ramp + closes Phase 1.5-deferred items that turn out to fit cleanly here.

10 requirements, executed in priority order. Drill queue routing first (closes the Phase 1 loop), strategic notes second (free render of catalog data), forks third (surface 0d.4 content).

## Requirements

### Requirement 1: Drill queue routing (`/drill?queue=due`)

**User Story:** As a player, when the Dashboard says "Drill 4 due", clicking it should drop me into a drill session that auto-cycles through those 4 lines.

#### Acceptance Criteria

1. THE SYSTEM SHALL accept `?queue=due` as a URL parameter on `/drill`.
2. WHEN `?queue=due` is set THE SYSTEM SHALL build the drill queue from `useSRS.dueLineIds` at page load.
3. WHEN a line in the queue completes THE SYSTEM SHALL auto-advance to the next line in the queue (no extra click).
4. WHEN the queue is exhausted THE SYSTEM SHALL render an "All caught up" state with link back to Dashboard.
5. THE SYSTEM SHALL display "Queue: N of M" indicator in the drill header during queue mode.
6. WHEN the user manually picks a different opening / line via the picker, THE SYSTEM SHALL exit queue mode (no implicit re-entry).
7. THE SYSTEM SHALL preserve URL state across line transitions (each line's drill page is bookmarkable via `?line=<id>` derived from the queue position).

### Requirement 2: Strategic notes panel

**User Story:** As a player, after I complete a line I want a 1-3 sentence reminder of what the line is for, so the drill is pedagogy not just memorization.

#### Acceptance Criteria

1. THE SYSTEM SHALL render `Line.strategic_notes` on the drill page in a dedicated panel.
2. THE PANEL SHALL be visible in all drill states (not just on completion) — collapsed by default with a chevron toggle, expanded on first open per session.
3. WHEN `strategic_notes` is empty, the panel SHALL render an empty-state caption ("No notes for this line yet"), not hidden entirely.
4. THE PANEL SHALL display a small "Strategy" header + bullet-list of notes.

### Requirement 3: Fork annotation rendering

**User Story:** As a player, when the line has a known decision point, I want to see the alternative moves + a one-line label so I learn the theory branches.

#### Acceptance Criteria

1. WHEN the active drill is at a position where a `ForkAnnotation` exists for the next ply, the move-history rail SHALL display a small fork badge at that ply.
2. CLICKING the fork badge SHALL open a popover listing the alternative SANs + the fork's `label` + `rationale` if present.
3. THE FORK PLY SHALL also render a subtle visual marker (e.g. a yellow dot) on the chess board's last-move square OR in the ply counter, indicating "fork ahead".
4. THE FORK POPOVER SHALL NOT block drill input. It is informational only; clicking an alternative does NOT change the drill line.

### Requirement 4: Tier 2 content expansion

**User Story:** As a player, I expect the trainer to cover the openings I actually face — not just 8 Tier 1 families.

#### Acceptance Criteria

1. THE catalog SHALL include at least 1 main line per the following Tier 2 families: Vienna, Scotch, Scandinavian, Pirc, Alekhine, Slav, Semi-Slav, Nimzo-Indian, Queen's Indian, Grünfeld, Catalan, English, KIA, Dutch.
2. EACH new line SHALL have ≥1 strategic note.
3. ECO + color SHALL be set per chess convention.
4. THE catalog rebuild SHALL pass all existing schema + Article 8 cap validations.

### Requirement 5: Repertoire presets

**User Story:** As a new user, I want a "Pick this repertoire" button so I can start drilling in 3 clicks instead of building one from scratch.

#### Acceptance Criteria

1. THE SETTINGS PAGE SHALL include a "Preset repertoires" section.
2. THE SYSTEM SHALL ship 3 presets: Beginner / Intermediate / Advanced (plus an "Off — custom" default).
3. THE preset declaration SHALL live in `scripts/curated/presets.yml` (additive, not blocking the build if missing).
4. THE preset metadata SHALL include: id, name, description, tier band (1 / 1+2 / all), recommended-for-color (white-only / black-only / both).
5. WHEN a preset is selected, THE SYSTEM SHALL persist the choice in localStorage `tabiya.repertoirePreset` and use it to filter the Repertoire page (showing only families in that tier band) AND the Drill picker.
6. THE Off / custom preset SHALL show all families (current behavior).

### Requirement 6: End-of-line summary screen

**User Story:** When I finish a line drill, I want a clean summary screen — what I just learned, my mastery shift, "next" CTA — not just an inline "Line complete" status text.

#### Acceptance Criteria

1. WHEN `state.kind === 'complete'` AND the drill was not in queue mode, THE SYSTEM SHALL render a summary card overlaying the lower drill area.
2. THE summary SHALL show: line name, ply count, wrong attempts, hint uses, duration, mastery before → after (Box → Box).
3. THE summary SHALL render the line's `strategic_notes` (full, no truncation).
4. THE summary SHALL include CTAs: "Restart this line", "Drill due", "Next in family".
5. WHEN the drill is in queue mode, the summary SHALL be skipped — auto-advance applies (per Requirement 1.3).

### Requirement 7: Per-line SRS reset

**User Story:** I want to reset SRS state for one line without nuking the whole catalog (for when I forget a specific opening but my other prep is solid).

#### Acceptance Criteria

1. THE Repertoire page line row SHALL include a small "..." menu icon (or right-click in v1.5).
2. THE menu SHALL include a "Reset SRS for this line" option.
3. THE option SHALL invoke `getSrsRepository().resetState(lineId)`.
4. THE menu SHALL be disabled when no SRS state exists for the line.

### Requirement 8: Position-keyed transposition index (DEFERRED)

**Out of scope for Phase 1c.** Captured as Phase 2 prep. Index FEN-normalized → reachable_via_lines map; required for game import.

### Requirement 9: RepertoirePick layer (DEFERRED)

**Out of scope for Phase 1c.** Captured as Phase 1.5 follow-up. Per-user pick at fork points + drives queue assembly.

### Requirement 10: Wife re-test UX intake doc

**User Story:** Wife is willing to re-test today. I need a skeleton intake doc ready so I capture friction with severity + triage routing instead of scribbling.

#### Acceptance Criteria

1. THE SYSTEM SHALL ship `specs/ux-intake-2026-05-10-priya.md` as a skeleton.
2. THE skeleton SHALL include: session frame, friction-point template (severity + triage + reproduction-steps), summary section.

## Constitution compliance

- Article 5 (Repository): all data access via `OpeningRepository` + `SrsRepository`. No direct concrete imports.
- Article 6 (Stable line.id): preset filters + per-line reset key on line.id only.
- Article 8 (20-ply cap): all new Tier 2 lines validated at build time.
- Article 9 (SAN): all new line PGNs in SAN.
- Article 11 (Local-first): preset choice in localStorage; queue mode is in-memory.
- Article 14 (Type discipline): no `any`; full TS strict + Python type hints on new modules.
