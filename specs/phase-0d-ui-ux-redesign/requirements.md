# Requirements: Phase 0d — v1 UI/UX Lock + Implementation Path

## Status

**LOCKED on v1 wireframe** (`wireframe.jsx`, ~1700 LOC mockup) as the design destination. Implementation is **design-led**: every surface in v1 will be built. The data layer is built TO match the design, not vice versa. The single visual change from v1 = larger hero board (~600px desktop, was ~480px).

## Locked target — v1 surfaces

The following surfaces are committed:

### Pages
- **Dashboard** — Welcome header, 4 stat cards (Lines mastered, Accuracy, Time this week, Due for review), Suggested-for-you card with PGN preview, Practice rhythm heatmap (12 wk × 7 d), Recent activity feed
- **Repertoire** — Page header + Add opening, side filters (All / White / Black), opening cards with mastery progress bars + ECO + last-drilled
- **Drill** — Title row with line switcher dropdown, hero board (≥600px), coaching/status card, action buttons row (Restart/Skip/Show solution), right rail with move history table + line progress bars + session stats
- **Progress** — Period filters (7d / 30d / 1y / all), accuracy chart, drill stats by period, mastered-by-period
- **Settings** — Theme toggle, account / Lichess sync, About

### App shell
- **Sidebar** (240px): logo lockup, Dashboard / Repertoire / Games nav, current-streak widget, profile dropdown (Profile / Progress / Settings / Sign out)
- **TopBar** (56px): breadcrumb + title, search box (⌘K), theme toggle, notifications bell

### Visual system
- Full v1 light + dark themes, 8 semantic color pairs (brand, amber, red, blue, pink, violet)
- Plus Jakarta Sans + JetBrains Mono fonts
- Card style with subtle border + soft shadow
- Token system as defined in v1 mockup

## Adjustments from v1

Single locked change:
1. **Hero board increased to ~600px** on desktop (was ~480px in v1). Right rail compresses to ~280px to fit. Mobile = single column, board first.

Keep everything else from v1.

## Build order (data-availability driven)

Each milestone ships visually-complete surfaces. Surfaces awaiting data render in **empty / loading / coming-soon** states until their data source lands. No faked data ever.

### Milestone 0d.1 — Visual system + drill-page real (1-2 weekends)
- Adopt full v1 token system (light + dark)
- Plus Jakarta Sans + JetBrains Mono fonts
- App shell: sidebar, topbar, theme toggle. Sidebar items: Dashboard / Repertoire / Drill / Progress / Settings. Streak widget shows "—" placeholder; profile dropdown shows local-only options.
- **Drill page fully real** — backed by current catalog. Includes title row, line switcher, hero board (≥600px), coaching card, status text, action buttons row, right rail with move history table (real). Line progress bars + session stats render with **in-memory drill data** (does not persist; resets on page reload — that's OK for 0d.1).
- **Repertoire page** with v1 cards. Mastery bars render at 0% with caption "Drill to track mastery." Cards link to drill.
- **Dashboard / Progress** rendered as styled "Coming soon" empty states matching v1 layout. No fake numbers.
- **Settings** real — theme toggle, version stamp, About link.

### Milestone 0d.2 / Phase 1 — SRS data layer (1-2 weekends)
- IndexedDB schema: `srs_state {line_id, box (1-5), last_reviewed}`
- Leitner scheduler (5 boxes, due-date logic)
- Drill completion → updates SRS state
- **Activates:** Repertoire mastery bars (real %), Dashboard "Lines mastered" + "Due for review" stats, Drill queue, sidebar mastery widget, line switcher mastery %, "last drilled" timestamps everywhere.

### Milestone 0d.3 / Phase 1.5 — Session event log (1 weekend)
- IndexedDB schema: `session_events {timestamp, line_id, ply, correct, duration_ms}`
- Append on every drill move
- **Activates:** Dashboard accuracy %, time-this-week, recent activity feed, suggested-for-you (lines with low accuracy + due), trend indicators, full Progress page (period filters with real data), heatmap, streak counter.

### Milestone 0d.4 / Phase 2.0 — Lichess sync (1-2 weekends)
- Lichess API client (profile + games endpoints)
- User connects Lichess account in Settings
- **Activates:** Profile dropdown Elo, game-derived drills ("you missed move 11"), enriched suggested-for-you, "Games" sidebar item.

### Milestone 0d.5 / Phase 2.5 — Polish (1 weekend)
- ⌘K search
- Notifications bell with real review-due alerts
- "Add opening" flow

**Total: 5-7 weekends of focused work to reach full v1.**

## Constraints (carried over)

- Constitution articles still apply (1, 5, 6, 7, 9, 11, 14, 16)
- All data computed locally (Article 11 — local-first); no backend until AI features (Phase 3)
- Lichess sync is opt-in, not gating
- Catalog interface (`OpeningRepository` + `Catalog` schema) untouched
- All chess moves SAN (Article 9)
- Stable line IDs across all data layers (Article 6) — SRS keyed by line.id

## Acceptance Criteria

To be filled in per-milestone in Phase 0d.1, 0d.2, etc., separate spec docs.

## What this is NOT

- Not a phase to compromise on v1 design
- Not a phase to ship fake data on any surface
- Not a phase to add features outside the v1 wireframe (no scope creep beyond what v1 already prescribes)
