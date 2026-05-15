/**
 * ArrowLayer — Phase 1b SVG arrow overlay for Explain Mode.
 *
 * Renders one `<line>` per `Arrow` over the board, with arrowhead markers.
 * Sized to the board panel via `boardSize` prop (consumer measures, ArrowLayer
 * stays dumb). Coordinates derived from `getSquarePixel`.
 *
 * CHOICE: pointer-events: none on the SVG — the arrows never block board
 * clicks. Article 15 sibling-primitive to `HighlightLayer`. Empty arrows
 * array → empty `<svg>`, no DOM churn.
 *
 * Article 14 — strict TS, no `any`.
 */

import { type CSSProperties } from 'react';
import type { Arrow, ArrowColor } from '../../storage/types';
import { getSquarePixel } from './squareGeometry';

const COLOR_MAP: Record<ArrowColor, string> = {
  green: '#15803d',
  red: '#b91c1c',
  blue: '#1d4ed8',
};

export type ArrowLayerProps = {
  arrows: readonly Arrow[];
  /** Edge length of the board in pixels. Match `<ChessBoardPanel>` width. */
  boardSize: number;
  /** True when the board is rendered from Black's perspective. */
  isFlipped: boolean;
  /** Optional override style for the SVG container. */
  style?: CSSProperties;
};

export function ArrowLayer({
  arrows,
  boardSize,
  isFlipped,
  style,
}: ArrowLayerProps): React.JSX.Element {
  const stroke = Math.max(2, boardSize / 80);
  const head = Math.max(8, boardSize / 24);

  // Stable marker ids per color so multiple ArrowLayers in one document
  // don't collide. Hash by color name is enough — only 3 colors.
  const markers = (Object.keys(COLOR_MAP) as ArrowColor[]).map((color) => (
    <marker
      key={color}
      id={`tabiya-arrowhead-${color}`}
      viewBox="0 0 10 10"
      refX="8"
      refY="5"
      markerWidth={head / 3}
      markerHeight={head / 3}
      orient="auto-start-reverse"
      markerUnits="userSpaceOnUse"
    >
      <path d="M0,0 L10,5 L0,10 Z" fill={COLOR_MAP[color]} />
    </marker>
  ));

  return (
    <svg
      data-testid="arrow-layer"
      width={boardSize}
      height={boardSize}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 6,
        ...style,
      }}
      viewBox={`0 0 ${boardSize} ${boardSize}`}
      aria-hidden="true"
    >
      <defs>{markers}</defs>
      {arrows.map((a, i) => {
        const from = getSquarePixel(a.from, isFlipped, boardSize);
        const to = getSquarePixel(a.to, isFlipped, boardSize);
        if (
          Number.isNaN(from.x) ||
          Number.isNaN(from.y) ||
          Number.isNaN(to.x) ||
          Number.isNaN(to.y)
        ) {
          return null;
        }
        const color = a.color ?? 'green';
        // Shorten the line slightly so the arrowhead sits inside the dest
        // square edge rather than dead center.
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.hypot(dx, dy);
        const shrink = Math.min(boardSize / 32, len * 0.18);
        const tx = to.x - (dx / len) * shrink;
        const ty = to.y - (dy / len) * shrink;
        return (
          <line
            key={`${a.from}-${a.to}-${i}`}
            x1={from.x}
            y1={from.y}
            x2={tx}
            y2={ty}
            stroke={COLOR_MAP[color]}
            strokeWidth={stroke}
            strokeLinecap="round"
            opacity={0.85}
            markerEnd={`url(#tabiya-arrowhead-${color})`}
          />
        );
      })}
    </svg>
  );
}
