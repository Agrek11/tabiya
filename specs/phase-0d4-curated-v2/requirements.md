# Requirements: Phase 0d.4 — Curated v2 (Variation Layer + Tier System)

## Status

✅ Shipped 2026-05-09. Document is the close-out spec; not pre-design.

## Introduction

Phase 0d.4 ships the missing middle layer between `Family` and `Line`. Phase 0d.3 introduced families but kept Variation collapsed into a 1:1 Opening (each Variation == one Opening). 0d.4 makes Variation a first-class entity, with a `tier` field on Family for repertoire presets, and `ForkAnnotation` on lines so sub-decisions ride inside a single Line node instead of spawning new tree nodes.

This is a hand-authored YAML-driven build path (`scripts/curated/families.yml` + `variations.yml` + `lines.yml`), invoked via `--source curated-v2` (now the default). The existing curated whitelist + Lichess Explorer extension path remains as `--source curated` for back-compat. `--source flat-tsv` (Phase 0d.3 follow-up) remains as a tooling/data path; not used for production.

## Requirements

### Requirement 1: 3-layer hierarchy

#### Acceptance Criteria

1. THE SYSTEM SHALL declare three nested entity types: Family → Variation → Line.
2. EACH Variation SHALL belong to exactly one Family via `family_id`.
3. EACH Line SHALL belong to exactly one Variation via `variation_id`.
4. THE SYSTEM SHALL synthesize one Opening per Variation (1:1) so the existing Opening-keyed APIs continue to work without breaking changes.
5. THE SYSTEM SHALL NOT introduce a 4th hierarchy layer; sub-decisions are captured inline as `ForkAnnotation` on the parent Line.

### Requirement 2: Family.tier

#### Acceptance Criteria

1. EACH Family SHALL declare a `tier` integer in {1, 2, 3}.
2. Tier 1 = must-have (drives ~70% of practical games).
3. Tier 2 = common but optional.
4. Tier 3 = offbeat (defaults off in beginner/intermediate presets).
5. THE SYSTEM SHALL preserve `tier` through catalog round-trip and expose it via the `OpeningRepository.listFamilies()` surface.

### Requirement 3: ForkAnnotation

#### Acceptance Criteria

1. EACH Line MAY include zero or more `ForkAnnotation` entries.
2. EACH ForkAnnotation SHALL declare: `ply_index` (0-based into `Line.moves`), `alternatives` (list of SAN strings), `label` (short string), and an optional `rationale`.
3. THE SYSTEM SHALL NOT validate that `alternatives` are legal moves at the given position in v1 (defer to authoring discipline).
4. THE SYSTEM SHALL preserve forks through catalog round-trip.

### Requirement 4: YAML curated source

#### Acceptance Criteria

1. THE SYSTEM SHALL read three YAML files: `scripts/curated/families.yml`, `variations.yml`, `lines.yml`.
2. THE BUILD SHALL fail-closed on dangling `family_id` / `variation_id` references with a non-zero exit code.
3. THE BUILD SHALL fail-closed on any line whose parsed PGN exceeds 20 ply (Constitution Article 8).
4. THE BUILD SHALL fail-closed on any illegal SAN sequence in a line PGN.
5. THE BUILD SHALL emit `Family.opening_ids` derived from the variations rooted in each family.
6. THE BUILD SHALL emit `Variation.line_ids` derived from the lines rooted in each variation.
7. THE BUILD SHALL emit a stable `line.id` per the YAML id field (Constitution Article 6).

### Requirement 5: TypeScript repository surface

#### Acceptance Criteria

1. THE SYSTEM SHALL extend `OpeningRepository` with: `listVariations()`, `getVariation(id)`, `listVariationsByFamily(familyId)`, `listLinesByVariation(variationId)`.
2. `JsonOpeningRepository` SHALL implement these methods.
3. THE catalog JSON validator SHALL accept catalogs without a `variations` field for back-compat (returns empty list from `listVariations()`).

### Requirement 6: Constitution compliance

#### Acceptance Criteria

1. Article 5: All new consumers go through `OpeningRepository`. No leak of concrete classes.
2. Article 6: Every `line.id` declared in `lines.yml` is stable and survives catalog rebuilds.
3. Article 7: Lines remain linear; ForkAnnotation is metadata, not a branch.
4. Article 8: 20-ply hard cap enforced in the loader.
5. Article 9: All moves in YAML are SAN.
6. Article 14: All new TS strict; no `any`. All new Python typed.

## What shipped

- 30 families across 3 tiers (8 / 14 / 8)
- 26 variations under the 8 Tier 1 families + 1 Scotch (Tier 2) seed
- 26 lines, 13-20 ply, with ForkAnnotation on 18 of them
- Catalog: ~50 KB
- Tests: 10 Python (curated_v2_builder) + 5 TS (variation methods)

## Out of scope (not in 0d.4)

- Tier 2 family expansion beyond Scotch (next session)
- Tier 3 family lines (deferred indefinitely; offbeat)
- Drill UI surfacing of ForkAnnotation (next: hover/popover at fork ply)
- Repertoire presets (beginner/intermediate/advanced) — Phase 1c
- Position-keyed transposition layer — Phase 2.5+
- Per-user RepertoirePick layer — Phase 1c

## References

- Constitution: `specs/constitution.md`
- Phase 0d.3 (parent): `specs/phase-0d3-catalog-v2/requirements.md`
- Phase 1 (sibling): `specs/phase-1-srs-data-layer/`
