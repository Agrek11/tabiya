# Requirements: Phase 0c — Storage Interface + Catalog-Driven Drill

## Introduction

Phase 0c wires the frontend to the catalog produced by Phase 0b. Behind a single repository interface (`OpeningRepository`), the app loads `public/catalog.json` once at startup, lets the user pick an opening + line, and drives the drill with the selected line's SAN moves. The interface gates all storage access (Constitution Article 5) so v2 (SQLite) is a one-line swap.

## Requirements

### Requirement 1: Repository Interface

**User Story:** As a developer, I want all catalog access to go through one interface, so that storage swaps don't ripple across the app.

#### Acceptance Criteria

1. THE SYSTEM SHALL define `OpeningRepository` in `src/storage/types.ts` with methods `listOpenings`, `getOpening`, `listLines`, `getLine`, `searchLines`.
2. THE SYSTEM SHALL define `Opening`, `Line`, `KeySquare`, `Catalog` TypeScript types mirroring the Pydantic schemas in Phase 0b 1:1.
3. NO consumer outside `src/storage/` SHALL import a concrete implementation directly (Constitution Article 5).

### Requirement 2: JSON Implementation

**User Story:** As the app, I want to load the bundled catalog and answer queries from memory.

#### Acceptance Criteria

1. THE SYSTEM SHALL implement `JsonOpeningRepository` that fetches `/catalog.json` once and caches the parsed data in memory.
2. WHEN the catalog fails to load THE SYSTEM SHALL surface the error to the caller (Promise rejection) so the UI can render a clear failure state.
3. THE SYSTEM SHALL validate the parsed JSON has the expected top-level shape (`version`, `openings`, `lines`) and reject otherwise.
4. `listLines(openingId)` SHALL return only lines whose `opening_id` matches.
5. `searchLines({color?, eco?, tags?})` SHALL filter accordingly; absent filter fields SHALL be no-ops.

### Requirement 3: Dependency Injection

**User Story:** As a consumer, I want one entry point to obtain the active repository.

#### Acceptance Criteria

1. THE SYSTEM SHALL expose a single `getRepository()` factory in `src/storage/index.ts` returning the active `OpeningRepository`.
2. WHEN `getRepository()` is called multiple times THE SYSTEM SHALL return the same instance (singleton).

### Requirement 4: Catalog-Driven Drill

**User Story:** As a player, I want to pick an opening and a line, so that I can drill any line in the catalog.

#### Acceptance Criteria

1. WHEN the app loads THE SYSTEM SHALL fetch the catalog and display a loading state until ready.
2. WHEN the catalog has loaded THE SYSTEM SHALL render an opening picker listing all openings.
3. WHEN the user selects an opening THE SYSTEM SHALL render a line picker listing that opening's lines.
4. WHEN the user selects a line THE SYSTEM SHALL drive the drill with that line's `moves`.
5. THE SYSTEM SHALL preselect the first opening + first line on initial load so the user sees a working drill immediately.
6. THE SYSTEM SHALL preserve user selections in component state (no persistence across reloads in this phase).
7. WHEN the catalog fails to load THE SYSTEM SHALL display a friendly error message with no broken UI.

### Requirement 5: Tests

**User Story:** As a developer, I want unit tests covering the storage seam.

#### Acceptance Criteria

1. THE SYSTEM SHALL include Vitest tests for `JsonOpeningRepository` covering: successful load, all 5 query methods, fetch failure, schema validation failure.
2. THE SYSTEM SHALL mock `fetch` in tests — no live network access.
3. THE SYSTEM SHALL include at least one rendering test for `DrillView` confirming the loading → ready transition.

## Constraints

- Frontend only (Constitution Articles 2, 12). No new Python.
- All chess move data stored as SAN, line IDs preserved as-is from catalog (Constitution Articles 6, 9).
- `src/drill/sample-line.ts` is NO LONGER used by `useDrill` after this phase. Keep file for now as a unit-test fixture; remove later when not referenced.
- Total LOC in `src/storage/` ≤ 200.
- Total new LOC in `src/ui/` (pickers + DrillView changes) ≤ 200.
- Loading + error states must be functional, not just thrown errors (Article 14 — type discipline + good UX).
