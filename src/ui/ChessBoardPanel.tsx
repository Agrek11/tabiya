/**
 * ChessBoardPanel — wraps react-chessboard with our app's prop shape.
 *
 * Theme-aware: light/dark square colors come from the active color scheme.
 * Per-square overlays (last-move + hint highlights) are honored by the
 * squareRenderer (react-chessboard skips its built-in squareStyles wiring
 * whenever a squareRenderer is set, so we apply them ourselves).
 *
 * Width is determined by the parent — this component fills 100% width.
 */

import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs } from 'react-chessboard';
import { unlockAudio } from '../sound/sounds';
import { useTheme } from '../theme/ThemeContext';

type FlashOverlay = { square: string; kind: 'correct' | 'wrong' } | null;

type ChessBoardPanelProps = {
  fen: string;
  flashOverlay: FlashOverlay;
  boardOrientation: 'white' | 'black';
  /** Optional override; defaults derive from current scheme. */
  lightSquare?: string;
  darkSquare?: string;
  /** Per-square background overlays (last-move highlight, hint highlight). */
  squareStyles?: Record<string, CSSProperties>;
  onPieceDrop: (args: { sourceSquare: string; targetSquare: string }) => boolean;
};

const wrapperStyle: CSSProperties = {
  width: '100%',
  margin: '0 auto',
};

const TICK_SVG = (
  <svg
    viewBox="0 0 100 100"
    style={{
      position: 'absolute',
      top: '4%',
      right: '4%',
      width: '32%',
      height: '32%',
      pointerEvents: 'none',
      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
      zIndex: 5,
    }}
  >
    <circle cx="50" cy="50" r="46" fill="rgba(40,170,60,0.96)" />
    <path
      d="M30 52 L46 68 L72 38"
      fill="none"
      stroke="white"
      strokeWidth="11"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CROSS_SVG = (
  <svg
    viewBox="0 0 100 100"
    style={{
      position: 'absolute',
      top: '4%',
      right: '4%',
      width: '32%',
      height: '32%',
      pointerEvents: 'none',
      filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
      zIndex: 5,
    }}
  >
    <circle cx="50" cy="50" r="46" fill="rgba(220,55,55,0.96)" />
    <path
      d="M34 34 L66 66 M66 34 L34 66"
      fill="none"
      stroke="white"
      strokeWidth="11"
      strokeLinecap="round"
    />
  </svg>
);

export function ChessBoardPanel({
  fen,
  flashOverlay,
  boardOrientation,
  lightSquare,
  darkSquare,
  squareStyles,
  onPieceDrop,
}: ChessBoardPanelProps) {
  const { scheme } = useTheme();
  const lightSq = lightSquare ?? (scheme === 'dark' ? '#D6CCAB' : '#EBECD0');
  const darkSq = darkSquare ?? (scheme === 'dark' ? '#5C7345' : '#779556');

  const handleDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (targetSquare === null) return false;
    return onPieceDrop({ sourceSquare, targetSquare });
  };

  const squareRenderer = ({
    square,
    children,
  }: {
    square: string;
    children?: React.ReactNode;
  }): React.JSX.Element => {
    const isFlash = flashOverlay !== null && flashOverlay.square === square;
    const custom = squareStyles?.[square];
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          ...custom,
        }}
      >
        {children}
        {isFlash && flashOverlay.kind === 'correct' ? TICK_SVG : null}
        {isFlash && flashOverlay.kind === 'wrong' ? CROSS_SVG : null}
      </div>
    );
  };

  return (
    <div style={wrapperStyle} onPointerDown={unlockAudio}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation,
          onPieceDrop: handleDrop,
          showAnimations: true,
          lightSquareStyle: { backgroundColor: lightSq },
          darkSquareStyle: { backgroundColor: darkSq },
          squareStyles: squareStyles ?? {},
          squareRenderer,
        }}
      />
    </div>
  );
}
