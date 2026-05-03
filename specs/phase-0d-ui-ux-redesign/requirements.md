# Requirements: Phase 0d — UI/UX Redesign (placeholder)

## Status

PLACEHOLDER — wireframes pending. User is producing wireframes externally (Figma + UX/UI LLMs) and will share them; this document is filled in after wireframe review.

## Scope (intent)

Visual + interaction redesign of the drill view. Behavior (state machine, catalog, sounds, hint, keyboard nav, wrong-move handling) stays unchanged. Surface area expected to change:

- Layout, spacing, typography
- Picker treatment (dropdowns vs sidebar list, etc.)
- Theme picker placement
- Hint affordance
- Keyboard shortcut surface
- Last-move + hint highlight color palette
- Status bar position / treatment
- Possible branding lockup
- Mobile responsiveness

## Constraints (carried over)

- No regressions on Phase 0a/0c functionality
- Constitution articles still apply (especially 1, 5, 9, 14, 16)
- Frontend only — no backend changes
- Catalog interface untouched (`OpeningRepository` + `Catalog` schema stable)
- All chess moves remain SAN (Article 9)
- Container distribution must still work (Article 16)

## Requirements

To be filled in after wireframe review.

## Acceptance Criteria

To be filled in after wireframe review.

## Workflow

1. User shares Figma wireframe link / images
2. Reviewer extracts: layout grid, typography, color tokens, component states (default, hover, active, disabled, error), interaction notes
3. Spec gets EARS-form acceptance criteria per component
4. Design doc captures the new component tree + style tokens
5. Tasks broken down by component
6. Implementation
