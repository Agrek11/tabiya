# Phase 0d.3 — Catalog v2 + Repertoire Restructure

**Trigger:** First non-self user (wife) feedback 2026-05-03. Item 3+4 from real-user list.
**Status:** SPEC ONLY (this doc). No implementation today. Implementation: Sat May 9 or later weekend.

---

## Problem

1. Current catalog flatness — 18 openings listed in a flat array. Sicilian variations (Najdorf, Dragon, Sveshnikov, etc.) appear at same level as fundamentally different openings (Ruy Lopez, French, Caro-Kann). Cognitive load on user.
2. Gambits have no first-class identity — King's Gambit appears as just another opening, but is a categorically different study target (sharper, tactical, narrower repertoire role).
3. Repertoire UX shows flat opening grid. Doesn't reflect chess pedagogy where openings are studied by family.

## Solution

Add `Family` schema layer above `Opening`. Refactor `build_catalog.py` to emit families. Redesign Repertoire page to use family-card UI with collapsible/drill-down navigation. Add dedicated Gambits surface.

## Acceptance criteria

### Catalog schema v2

- [ ] New `Family` interface added to `src/storage/types.ts`
- [ ] `Opening` interface gains `family_id: string` field
- [ ] `Opening` interface gains optional `is_gambit?: boolean` flag
- [ ] `OpeningRepository` interface gains: `listFamilies()`, `getFamily(id)`, `listOpeningsByFamily(familyId)`, `listGambits()`
- [ ] `JsonOpeningRepository` implements new methods
- [ ] `catalog.json` schema v2 emitted by `build_catalog.py` v2 with `families` array and `family_id` on every opening
- [ ] Backward compatibility: existing 18 openings retro-assigned `family_id`. Stable line.id preserved (SRS state safe).
- [ ] Catalog `version` field bumped

### Initial families seed (~12 families)

- `open-games` (1.e4 e5): Ruy Lopez, Italian, Scotch, King's Gambit (gambit), Vienna
- `semi-open` (1.e4 not-e5): Sicilian + variations, French, Caro-Kann, Scandinavian, Pirc, Alekhine
- `closed-games` (1.d4 d5): Queen's Gambit (Declined/Accepted), Slav, Semi-Slav, London
- `indian-defenses` (1.d4 Nf6): King's Indian, Nimzo-Indian, Queen's Indian, Grünfeld, Benoni
- `flank-openings` (1.c4 / 1.Nf3 / 1.b3): English, Réti, Larsen, Bird
- `gambits` (cross-cut category): King's Gambit, Evans Gambit, Smith-Morra, Benko, Latvian, Budapest, Albin

Sicilian internally splits into subfamilies — but for v2 keep flat: Sicilian Najdorf, Dragon, Sveshnikov etc. all under `family_id: 'sicilian-defense'`. Drill-down beyond family → opening → line is enough for now. Sub-families (Open Sicilian / Closed Sicilian) deferred.

### Repertoire page v2

- [ ] Top-level grid: family cards (12 cards, NOT 18 openings)
- [ ] Family card shows: name, ECO range, child opening count, aggregate mastery % (placeholder until SRS)
- [ ] Click family card → expands inline OR routes to `/repertoire/{family-id}` (decide during build; lean inline-expand for v1)
- [ ] Search bar across families + openings + lines
- [ ] Filter chips: by color (white/black), by category (open/semi-open/closed/indian/flank/gambit)
- [ ] Gambits card visually distinct (e.g. flame icon, slightly different background)
- [ ] Optionally: dedicated `/repertoire/gambits` route showing all gambit-flagged openings cross-cut from any category
- [ ] Existing "Drill to track" mastery placeholder text preserved until Phase 1 SRS lands

### Drill page line-switcher dropdown v2

- [ ] Dropdown groups by family (12 sections instead of 18 sections)
- [ ] Each family section header shows family name + ECO range
- [ ] Within family, openings listed with line children
- [ ] Search input at top filters across all 3 levels

## Out of scope

- Sub-family hierarchy (Open Sicilian / Closed Sicilian / Anti-Sicilian)
- Per-family icons beyond gambit flag
- Re-running Lichess Explorer pulls (catalog v2 reuses cached opening data)
- AI features (Phase 4)

## Dependencies

- None on Phase 1 SRS (mastery rollup display gates on Phase 1 + 0d.3 both done, but each can ship independently)
- Mild dependency on Phase 0d.2: better to land 0d.2 sound + rail first so wife can re-test and confirm baseline before adding family complexity

## Estimated effort

- Catalog schema + build_catalog.py v2: ~3 hr
- Repository interface + JsonOpeningRepository methods: ~1 hr
- Repertoire page v2 UI: ~3-4 hr
- Drill line-switcher v2: ~1 hr
- Tests: ~1-2 hr
- **Total: ~10-12 hr → 1 weekend.**

## Migration plan

1. Run `build_catalog.py` v2 → emits new `catalog.json` (preserves all line.id values)
2. Bump catalog `version` field
3. Frontend reads new schema; old `JsonOpeningRepository` methods unchanged behavior; new methods added
4. Update Repertoire page render
5. Update Drill line-switcher render
6. SRS state (when it lands Phase 1) keys by line.id — survives this migration

## Risk: scope creep

This phase has 5 interconnected pieces. Easy to slip into "while I'm here" expansions:
- Sub-families
- Tags-driven filtering (positional vs tactical, e2e4 vs d2d4)
- Mastery aggregation math (defer until Phase 1 lands)
- Dedicated gambit-detail page

**HARD RULE for this phase:** ship ONLY items in acceptance criteria. Defer everything else to Phase 0d.4 or later.
