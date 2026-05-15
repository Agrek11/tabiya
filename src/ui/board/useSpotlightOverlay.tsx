/**
 * useSpotlightOverlay — Phase 2b Pattern Visualization hook (R6).
 *
 * The hook half of `SpotlightOverlay`. Lives in its own file so the
 * sibling `.tsx` exports only the component (fast-refresh-friendly).
 *
 * Returns the derived square styles, the piece-fade hint, and a tooltip
 * element + hover handler. Callers (DrillPage, ExplainView) merge the
 * styles into ChessBoardPanel's `squareStyles` and render the tooltip
 * inside a `position: relative` board wrapper.
 *
 * R6.6: empty or undefined `keySquares` → inert result (no styles, no
 * tooltip, opacity=1).
 *
 * Article 14: strict TS, no `any`.
 */

import { useMemo, useState, type CSSProperties } from 'react';
import { deriveHighlightStyles } from './HighlightLayer';
import { KeySquareTooltip } from '../KeySquareOverlay';
import type { KeySquare } from '../../storage/types';

export type SpotlightOverlayProps = {
  /** Key squares from `Line.key_squares` (existing catalog field). */
  keySquares: readonly KeySquare[] | undefined;
  /** Fade non-highlighted pieces under the dim layer. Default true. */
  fadePieces?: boolean;
};

export type SpotlightOverlayResult = {
  /**
   * Merge into ChessBoardPanel `squareStyles`. Empty object when no data
   * (graceful degrade R6.6).
   */
  squareStyles: Record<string, CSSProperties>;
  /** Apply to board wrapper `style.opacity` to fade pieces. 1 = no fade. */
  pieceOpacity: number;
  /** Whether the overlay is showing anything. */
  active: boolean;
  /** Tooltip element to render inside a position:relative board wrapper. */
  tooltip: React.JSX.Element | null;
  /** Hover handler — wire to ChessBoardPanel `onSquareMouseOver` etc. */
  onSquareHover(square: string | null): void;
};

export function useSpotlightOverlay({
  keySquares,
  fadePieces = true,
}: SpotlightOverlayProps): SpotlightOverlayResult {
  const [hovered, setHovered] = useState<string | null>(null);

  const squares = useMemo(
    () =>
      (keySquares ?? []).map((k) => ({
        square: k.square,
        note: k.note,
        side: k.side,
      })),
    [keySquares],
  );

  const derived = useMemo(
    () =>
      deriveHighlightStyles({
        mode: 'bright',
        squares,
        fadePieces,
      }),
    [squares, fadePieces],
  );

  if (squares.length === 0) {
    return {
      squareStyles: {},
      pieceOpacity: 1,
      active: false,
      tooltip: null,
      onSquareHover: setHovered,
    };
  }

  const tooltip = (
    <KeySquareTooltip keySquares={[...squares]} hoveredSquare={hovered} />
  );

  return {
    squareStyles: derived.squareStyles,
    pieceOpacity: derived.pieceOpacity,
    active: derived.active,
    tooltip,
    onSquareHover: setHovered,
  };
}
