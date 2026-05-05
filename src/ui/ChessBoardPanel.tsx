/**
 * ChessBoardPanel — wraps react-chessboard with our app's prop shape.
 *
 * Theme-aware: light/dark square colors come from BoardThemeContext (user
 * preference) or fall back to the active app color scheme.
 *
 * Per-square overlays (last-move + hint highlights) are honored by the
 * squareRenderer. Phase 0d.2 polish:
 *   - Last-move highlight uses subtler lichess-style green tint (no inset
 *     shadow), so the position reads cleanly.
 *   - Tick/cross icons sit in top-right at slightly smaller size and fade
 *     in/out over 150ms.
 *   - Board flip animation (300ms) when boardOrientation changes.
 *
 * Width is determined by the parent — this component fills 100% width.
 */

import { useEffect, useState, type CSSProperties } from 'react';
import { Chessboard } from 'react-chessboard';
import type { PieceDropHandlerArgs } from 'react-chessboard';
import { useBoardTheme } from '../theme/BoardThemeContext';
import { usePieceSet } from '../theme/PieceSetContext';

type FlashOverlay = { square: string; kind: 'correct' | 'wrong' } | null;

type ChessBoardPanelProps = {
  fen: string;
  flashOverlay: FlashOverlay;
  boardOrientation: 'white' | 'black';
  /** Optional override; defaults derive from BoardThemeContext. */
  lightSquare?: string;
  darkSquare?: string;
  /** Per-square background overlays (last-move highlight, hint highlight). */
  squareStyles?: Record<string, CSSProperties>;
  onPieceDrop: (args: { sourceSquare: string; targetSquare: string }) => boolean;
  /** Click-to-move: square the user clicked first; null if no piece selected. */
  selectedSquare?: string | null;
  /** Squares the selected piece can legally land on; rendered as green dots. */
  legalDestSquares?: readonly string[];
  /** Click handler for any square (incl. piece-occupied). Args mirror
   *  react-chessboard's onSquareClick: `{ piece, square }`. */
  onSquareClick?: (args: { piece: unknown; square: string }) => void;
  /** Click handler for piece. Args mirror react-chessboard's onPieceClick. */
  onPieceClick?: (args: { piece: unknown; square: string | null }) => void;
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
      top: '6%',
      right: '6%',
      width: '26%',
      height: '26%',
      pointerEvents: 'none',
      filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))',
      zIndex: 5,
      animation: 'tabiya-flash 180ms ease-out',
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
      top: '6%',
      right: '6%',
      width: '26%',
      height: '26%',
      pointerEvents: 'none',
      filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))',
      zIndex: 5,
      animation: 'tabiya-flash 180ms ease-out',
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
  selectedSquare,
  legalDestSquares,
  onSquareClick,
  onPieceClick,
}: ChessBoardPanelProps) {
  const { theme } = useBoardTheme();
  const { pieces: pieceRenderObject } = usePieceSet();
  const lightSq = lightSquare ?? theme.light;
  const darkSq = darkSquare ?? theme.dark;

  // Board flip animation: brief opacity dip on orientation change.
  const [flipping, setFlipping] = useState(false);
  useEffect(() => {
    setFlipping(true);
    const id = window.setTimeout(() => setFlipping(false), 300);
    return () => window.clearTimeout(id);
  }, [boardOrientation]);

  const handleDrop = ({ sourceSquare, targetSquare }: PieceDropHandlerArgs): boolean => {
    if (targetSquare === null) return false;
    return onPieceDrop({ sourceSquare, targetSquare });
  };

  const legalDestSet = legalDestSquares ? new Set(legalDestSquares) : null;

  const squareRenderer = ({
    square,
    piece,
    children,
  }: {
    square: string;
    piece?: unknown;
    children?: React.ReactNode;
  }): React.JSX.Element => {
    const isFlash = flashOverlay !== null && flashOverlay.square === square;
    const custom = squareStyles?.[square];
    const isSelected = selectedSquare === square;
    const isLegalDest = legalDestSet?.has(square) ?? false;
    const occupied = piece !== null && piece !== undefined;
    return (
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          ...(isSelected ? { backgroundColor: 'rgba(155, 199, 0, 0.55)' } : null),
          ...custom,
        }}
      >
        {children}
        {isLegalDest && (
          // Lichess-style hint: small dot on empty squares, ring on captures.
          <div
            aria-hidden
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              zIndex: 4,
            }}
          >
            {occupied ? (
              <div
                style={{
                  width: '88%',
                  height: '88%',
                  borderRadius: '50%',
                  border: '4px solid rgba(40, 40, 40, 0.32)',
                  boxSizing: 'border-box',
                }}
              />
            ) : (
              <div
                style={{
                  width: '28%',
                  height: '28%',
                  borderRadius: '50%',
                  background: 'rgba(40, 40, 40, 0.32)',
                }}
              />
            )}
          </div>
        )}
        {isFlash && flashOverlay.kind === 'correct' ? TICK_SVG : null}
        {isFlash && flashOverlay.kind === 'wrong' ? CROSS_SVG : null}
      </div>
    );
  };

  return (
    <div
      style={{
        ...wrapperStyle,
        transition: 'opacity 300ms ease',
        opacity: flipping ? 0.55 : 1,
      }}
      data-testid="board-wrapper"
    >
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
          ...(onSquareClick ? { onSquareClick } : {}),
          ...(onPieceClick ? { onPieceClick } : {}),
          ...(pieceRenderObject ? { pieces: pieceRenderObject } : {}),
        }}
      />
    </div>
  );
}
