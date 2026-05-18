/**
 * HighlightLayer — Phase 1b + Phase 2 single highlight primitive (Article 15).
 *
 * Wraps the existing `deriveKeySquareStyles` derivation core from
 * `src/ui/KeySquareOverlay.tsx` and exposes a discriminated-mode component
 * shape so both Pattern Viz (Phase 1.5/2) and Explain Mode (Phase 1b)
 * consume one component, not two.
 *
 * CHOICE: HighlightLayer is a "thin component" — it returns a derived
 * `squareStyles` map that the consumer applies to `<ChessBoardPanel>` via
 * its `squareStyles` prop. This keeps board-overlay rendering inside
 * ChessBoardPanel's squareRenderer (no separate DOM layer for highlights),
 * which matches how `KeySquareOverlay` was originally designed.
 *
 * Why a discriminated `mode` union:
 *   - 'bright'    — Phase 2 Pattern Viz: full saturation, fade pieces.
 *                   Consumer reads `pieceOpacity` and applies to the board
 *                   wrapper.
 *   - 'spotlight' — Phase 1b Explain Mode: lighter glow per `intent`
 *                   (focus/threat/support), no piece-fade.
 *
 * Article 15 keeps Phase 2 from forking a parallel primitive — when Phase 2
 * lands, it consumes this same component with `mode='bright'`.
 *
 * Article 14 — strict TS, no `any`.
 */

import { type CSSProperties } from 'react';
import { deriveKeySquareStyles } from '../KeySquareOverlay';
import type { HighlightSquare } from '../../storage/types';

type BrightModeProps = {
  mode: 'bright';
  /** Pattern Viz key squares (Phase 2 shape). */
  squares: ReadonlyArray<{
    square: string;
    note?: string;
    side?: 'white' | 'black' | 'both';
    role?: 'outpost' | 'weak' | 'target' | 'break' | 'tension' | 'control' | 'pivot';
  }>;
  /** Fade non-highlighted pieces under the layer. Default true for bright. */
  fadePieces?: boolean;
};

type SpotlightModeProps = {
  mode: 'spotlight';
  /** Explain Mode squares with optional `intent` styling. */
  squares: ReadonlyArray<HighlightSquare>;
};

export type HighlightLayerProps = BrightModeProps | SpotlightModeProps;

export type HighlightLayerResult = {
  /** Merge into ChessBoardPanel `squareStyles`. */
  squareStyles: Record<string, CSSProperties>;
  /** Piece opacity hint for the consumer to apply. 1 when no fade. */
  pieceOpacity: number;
  active: boolean;
};

const SPOTLIGHT_STYLES: Record<NonNullable<HighlightSquare['intent']> | 'default', CSSProperties> = {
  default: {
    backgroundColor: 'rgba(255, 200, 60, 0.40)',
    boxShadow: 'inset 0 0 0 3px rgba(220, 160, 30, 0.85)',
  },
  focus: {
    backgroundColor: 'rgba(80, 160, 255, 0.40)',
    boxShadow: 'inset 0 0 0 3px rgba(40, 120, 230, 0.85)',
  },
  threat: {
    backgroundColor: 'rgba(220, 60, 70, 0.40)',
    boxShadow: 'inset 0 0 0 3px rgba(180, 30, 40, 0.85)',
  },
  support: {
    backgroundColor: 'rgba(70, 200, 130, 0.40)',
    boxShadow: 'inset 0 0 0 3px rgba(40, 150, 90, 0.85)',
  },
};

/** Pure derivation — consume via `useHighlightLayer` or call directly. */
export function deriveHighlightStyles(
  props: HighlightLayerProps,
): HighlightLayerResult {
  if (props.mode === 'bright') {
    const r = deriveKeySquareStyles({
      keySquares: props.squares as Array<{
        square: string;
        note?: string;
        side?: 'white' | 'black' | 'both';
        role?: 'outpost' | 'weak' | 'target' | 'break' | 'tension' | 'control' | 'pivot';
      }>,
      fadePieces: props.fadePieces ?? true,
    });
    return { squareStyles: r.squareStyles, pieceOpacity: r.pieceOpacity, active: r.active };
  }
  // spotlight (Explain Mode)
  const styles: Record<string, CSSProperties> = {};
  for (const hl of props.squares) {
    styles[hl.square] = SPOTLIGHT_STYLES[hl.intent ?? 'default'];
  }
  return {
    squareStyles: styles,
    pieceOpacity: 1,
    active: props.squares.length > 0,
  };
}

/**
 * Component form. Renders nothing on its own — returns a `<style>`-less
 * element used purely for prop passthrough. The caller pulls the derived
 * styles via `deriveHighlightStyles(...)`. We keep the component shell to
 * give Phase 2 future room to add a DOM-layer rendering if pattern viz
 * needs more than square-style merging (e.g. animated halos).
 */
export function HighlightLayer(_props: HighlightLayerProps): React.JSX.Element | null {
  return null;
}
