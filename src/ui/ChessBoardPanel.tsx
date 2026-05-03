/**
 * ChessBoardPanel — wraps react-chessboard with our app's prop shape.
 *
 * - Adapts react-chessboard v5 onPieceDrop (targetSquare: string | null) to
 *   our hook's API.
 * - Uses `squareRenderer` to overlay a tick/cross icon at top-right of the
 *   destination square, sitting OVER the piece (not behind it).
 * - Orientation, theme, and unlock-audio handled.
 */

import type { CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs } from 'react-chessboard';
import type { BoardTheme } from '../theme/themes';
import { unlockAudio } from '../sound/sounds';

type FlashOverlay = { square: string; kind: 'correct' | 'wrong' } | null;

type ChessBoardPanelProps = {
  fen: string;
  flashOverlay: FlashOverlay;
  boardOrientation: 'white' | 'black';
  theme: BoardTheme;
  onPieceDrop: (args: { sourceSquare: string; targetSquare: string }) => boolean;
};

const wrapperStyle: CSSProperties = {
  width: 'min(480px, 92vw)',
  margin: '0 auto',
};

// SVG overlay icons — sized at 30% of square, positioned top-right corner.
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
  theme,
  onPieceDrop,
}: ChessBoardPanelProps) {
  const handleDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (targetSquare === null) return false;
    return onPieceDrop({ sourceSquare, targetSquare });
  };

  // Custom square renderer — adds an absolute-positioned overlay on the
  // flashed square. Overlay sits ABOVE the piece (zIndex 5; pieces render
  // around zIndex 1-2 in react-chessboard).
  const squareRenderer = ({
    square,
    children,
  }: {
    square: string;
    children?: React.ReactNode;
  }): React.JSX.Element => {
    const isFlash = flashOverlay !== null && flashOverlay.square === square;
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
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
          lightSquareStyle: { backgroundColor: theme.light },
          darkSquareStyle: { backgroundColor: theme.dark },
          // squareRenderer wraps each square's contents (the piece) with our overlay layer
          squareRenderer,
        }}
      />
    </div>
  );
}
