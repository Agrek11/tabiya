/**
 * KeySquareOverlay — Phase 2 primitive (scaffold).
 *
 * Renders glowing square overlays + optional faded-piece state on top of the
 * board. Used by:
 *   - Pattern Viz toggle (Phase 2)         — user clicks "Visualize" in line-review
 *   - End-of-line plan panel (Phase 2)     — user clicks a plan, plan's squares glow
 *   - AI Coach explanations (Phase 4)      — coach output points to specific squares
 *
 * This is the SCAFFOLD only — wired-in usage lands in Phase 2 once `key_squares`
 * are curated and `plans` are baked into the catalog. Component renders nothing
 * unless `keySquares` is non-empty.
 *
 * Design:
 *   - `fadePieces` opacity is applied via parent — this component doesn't own
 *     the piece elements. It returns square-overlay style records that the
 *     consumer (DrillPage / future PlanPanel) merges into ChessBoardPanel's
 *     `squareStyles` prop AND a `pieceOpacity` value the consumer applies via
 *     CSS to the board container.
 *
 *   - Hover/click on a key square pops the strategic note tooltip. Tooltip
 *     positioning uses absolute coordinates inside the board's bounding box.
 */

import { useState, type CSSProperties } from 'react';

export type KeySquare = {
  square: string; // e.g. "d5"
  note?: string; // strategic role
  side?: 'white' | 'black' | 'both';
};

export type KeySquareOverlayConfig = {
  /** Squares to highlight. Empty = component renders nothing. */
  keySquares: KeySquare[];
  /** Whether to fade pieces (applies on consumer's wrapper). */
  fadePieces?: boolean;
};

export type KeySquareOverlayResult = {
  /** Merge into ChessBoardPanel `squareStyles`. */
  squareStyles: Record<string, CSSProperties>;
  /** Apply via `style.opacity` on board wrapper to fade pieces. 1 when off. */
  pieceOpacity: number;
  /** Whether overlay is "active" (any squares present). */
  active: boolean;
};

/**
 * Pure config → style derivation. Hook-free, easy to test.
 *
 * Color scheme:
 *   - white-side squares     → light blue glow
 *   - black-side squares     → light pink glow
 *   - both / unspecified     → gold/amber glow
 */
export function deriveKeySquareStyles({
  keySquares,
  fadePieces = false,
}: KeySquareOverlayConfig): KeySquareOverlayResult {
  if (keySquares.length === 0) {
    return { squareStyles: {}, pieceOpacity: 1, active: false };
  }

  const styles: Record<string, CSSProperties> = {};

  for (const ks of keySquares) {
    const color = colorForSide(ks.side);
    styles[ks.square] = {
      backgroundColor: color.fill,
      boxShadow: `inset 0 0 0 4px ${color.ring}, 0 0 12px ${color.glow}`,
    };
  }

  return {
    squareStyles: styles,
    pieceOpacity: fadePieces ? 0.22 : 1,
    active: true,
  };
}

function colorForSide(side: 'white' | 'black' | 'both' | undefined): {
  fill: string;
  ring: string;
  glow: string;
} {
  switch (side) {
    case 'white':
      return {
        fill: 'rgba(80, 160, 255, 0.55)',
        ring: 'rgba(40, 120, 230, 0.95)',
        glow: 'rgba(80, 160, 255, 0.45)',
      };
    case 'black':
      return {
        fill: 'rgba(255, 100, 170, 0.55)',
        ring: 'rgba(220, 60, 130, 0.95)',
        glow: 'rgba(255, 100, 170, 0.45)',
      };
    case 'both':
    case undefined:
    default:
      return {
        fill: 'rgba(255, 200, 60, 0.55)',
        ring: 'rgba(220, 160, 30, 0.95)',
        glow: 'rgba(255, 200, 60, 0.45)',
      };
  }
}

/**
 * Tooltip-on-click renderer for key squares. Standalone component used by
 * Phase 2 surfaces. Positioned absolutely inside a relative-positioned parent.
 */
export function KeySquareTooltip({
  keySquares,
  hoveredSquare,
}: {
  keySquares: KeySquare[];
  hoveredSquare: string | null;
}): React.JSX.Element | null {
  if (!hoveredSquare) return null;
  const ks = keySquares.find((k) => k.square === hoveredSquare);
  if (!ks || !ks.note) return null;

  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(20, 20, 22, 0.92)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: 8,
        fontSize: 13,
        lineHeight: 1.4,
        maxWidth: 320,
        textAlign: 'center',
        pointerEvents: 'none',
        zIndex: 30,
        boxShadow: '0 4px 16px rgba(0,0,0,0.45)',
      }}
    >
      <strong style={{ marginRight: 6 }}>{ks.square}:</strong>
      {ks.note}
    </div>
  );
}

/**
 * Convenience hook: wraps keySquare config in a component-friendly stateful
 * shell. Returns derive output + hover-square handlers for tooltip wiring.
 */
export function useKeySquareOverlay(config: KeySquareOverlayConfig): {
  result: KeySquareOverlayResult;
  hoveredSquare: string | null;
  onSquareHover: (square: string | null) => void;
} {
  const [hoveredSquare, setHoveredSquare] = useState<string | null>(null);
  const result = deriveKeySquareStyles(config);
  return { result, hoveredSquare, onSquareHover: setHoveredSquare };
}
