/**
 * Piece set presets — 3 styles, lightweight (no SVG-bundle overhead).
 *
 * Persisted to localStorage `tabiya.pieceSet`. Default = react-chessboard's
 * built-in cburnett (we don't pass `pieces` prop, library handles).
 *
 * Alt sets:
 *   - 'letter'  — bold colored letter pieces (K Q R B N P)
 *   - 'symbol'  — Unicode chess characters (♔ ♕ ♖ ♗ ♘ ♙)
 *
 * react-chessboard `PieceRenderObject` shape:
 *   Record<FenPieceChar, (props?: { fill?, square?, svgStyle? }) => ReactNode>
 *
 * We render plain SVG with text-as-piece — kept under 30 lines/set total.
 */

import type { CSSProperties, JSX } from 'react';

export type PieceSetId = 'default' | 'letter' | 'symbol';

export type PieceSetOption = {
  id: PieceSetId;
  label: string;
  description: string;
};

export const PIECE_SETS: PieceSetOption[] = [
  { id: 'default', label: 'Classic', description: 'Standard cburnett-style.' },
  { id: 'letter', label: 'Letter', description: 'Bold letter pieces (K Q R B N P).' },
  { id: 'symbol', label: 'Unicode', description: 'Chess Unicode glyphs (♔ ♕ ♖).' },
];

const KEY = 'tabiya.pieceSet';

export function readPieceSet(): PieceSetId {
  if (typeof window === 'undefined') return 'default';
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === 'letter' || raw === 'symbol' || raw === 'default') return raw;
    return 'default';
  } catch {
    return 'default';
  }
}

export function writePieceSet(id: PieceSetId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(KEY, id);
  } catch {
    /* quota / private */
  }
}

// ---------------------------------------------------------------------------
// Piece renderers
// ---------------------------------------------------------------------------

const PIECE_CHARS: Record<string, string> = {
  P: 'P',
  N: 'N',
  B: 'B',
  R: 'R',
  Q: 'Q',
  K: 'K',
  p: 'P',
  n: 'N',
  b: 'B',
  r: 'R',
  q: 'Q',
  k: 'K',
};

const UNICODE_PIECES: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
  P: '♙',
  k: '♚',
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

type PieceRenderProps = {
  fill?: string;
  square?: string;
  svgStyle?: CSSProperties;
};

function makeLetterRenderer(fenChar: string): (props?: PieceRenderProps) => JSX.Element {
  const isWhite = fenChar === fenChar.toUpperCase();
  const letter = PIECE_CHARS[fenChar] ?? '?';
  return function LetterPiece(props?: PieceRenderProps): JSX.Element {
    return (
      <svg viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
        <circle
          cx="22.5"
          cy="22.5"
          r="17"
          fill={isWhite ? '#FFFFFF' : '#1F1F1F'}
          stroke={isWhite ? '#1F1F1F' : '#FFFFFF'}
          strokeWidth="1.4"
        />
        <text
          x="22.5"
          y="29"
          textAnchor="middle"
          fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
          fontWeight="700"
          fontSize="20"
          fill={isWhite ? '#1F1F1F' : '#FFFFFF'}
        >
          {letter}
        </text>
      </svg>
    );
  };
}

function makeSymbolRenderer(fenChar: string): (props?: PieceRenderProps) => JSX.Element {
  const isWhite = fenChar === fenChar.toUpperCase();
  const glyph = UNICODE_PIECES[fenChar] ?? '?';
  return function SymbolPiece(props?: PieceRenderProps): JSX.Element {
    return (
      <svg viewBox="0 0 45 45" width="100%" height="100%" style={props?.svgStyle}>
        <text
          x="22.5"
          y="36"
          textAnchor="middle"
          fontFamily="'DejaVu Sans', 'Apple Symbols', 'Segoe UI Symbol', sans-serif"
          fontSize="40"
          fill={isWhite ? '#FFFFFF' : '#1F1F1F'}
          stroke={isWhite ? '#1F1F1F' : '#FFFFFF'}
          strokeWidth="0.8"
          paintOrder="stroke fill"
        >
          {glyph}
        </text>
      </svg>
    );
  };
}

// ---------------------------------------------------------------------------
// Build renderer object
// ---------------------------------------------------------------------------

export type PieceRenderObject = Record<
  string,
  (props?: PieceRenderProps) => JSX.Element
>;

export function buildPieceRenderObject(id: PieceSetId): PieceRenderObject | undefined {
  if (id === 'default') return undefined; // let react-chessboard render its built-in
  const factory = id === 'letter' ? makeLetterRenderer : makeSymbolRenderer;
  const fenChars = ['P', 'N', 'B', 'R', 'Q', 'K', 'p', 'n', 'b', 'r', 'q', 'k'];
  const obj: PieceRenderObject = {};
  for (const c of fenChars) {
    obj[c] = factory(c);
  }
  return obj;
}
