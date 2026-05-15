/**
 * SpotlightOverlay — Phase 2b Pattern Visualization adapter (R6).
 *
 * Thin component wrapping `useSpotlightOverlay` (sibling file) for
 * callers that just want a drop-in tooltip surface. The hook is the
 * primary API — DrillPage and ExplainView import `useSpotlightOverlay`
 * directly because they need the derived `squareStyles` for merging
 * into the board's style map. This component exists for the "I just
 * want a tooltip and have already merged styles elsewhere" path.
 *
 * Article 15: this is an adapter over the shared `<HighlightLayer>`
 *   primitive, not a fork. The hook calls `deriveHighlightStyles`
 *   internally.
 *
 * Article 14: strict TS, no `any`.
 */

import {
  useSpotlightOverlay,
  type SpotlightOverlayProps,
} from './useSpotlightOverlay';

export function SpotlightOverlay(
  props: SpotlightOverlayProps,
): React.JSX.Element | null {
  const r = useSpotlightOverlay(props);
  return r.tooltip;
}
