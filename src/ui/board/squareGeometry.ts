/**
 * squareGeometry — pure math helpers for converting algebraic squares to
 * pixel coordinates over a board of known size, honoring flip orientation.
 *
 * Used by `<ArrowLayer>` to draw SVG arrows between squares; would also be
 * useful for any future overlay that needs square centers (e.g. heatmaps).
 *
 * Coordinate convention: origin at top-left of the board panel, x right, y
 * down — matches HTML/SVG.
 *
 * Article 14 — strict TS, no `any`. Pure functions, trivially testable.
 */

/**
 * Coordinates (in board pixels) for the center of `square`.
 *
 * Args:
 *   square     — algebraic square, e.g. "e4". Lowercase a-h, digit 1-8.
 *   isFlipped  — true when the board is rendered from Black's perspective.
 *   boardSize  — board edge length in pixels.
 *
 * Returns { x, y } in pixels, NaN if the square string is malformed.
 */
export function getSquarePixel(
  square: string,
  isFlipped: boolean,
  boardSize: number,
): { x: number; y: number } {
  if (square.length !== 2) return { x: Number.NaN, y: Number.NaN };
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0..7
  const rank = Number.parseInt(square[1] ?? '', 10) - 1; // 0..7
  if (file < 0 || file > 7 || Number.isNaN(rank) || rank < 0 || rank > 7) {
    return { x: Number.NaN, y: Number.NaN };
  }
  const squareSize = boardSize / 8;
  const col = isFlipped ? 7 - file : file;
  // White's rank 1 is at the BOTTOM (y = 7 * sq) when not flipped. When
  // flipped, rank 1 is at the top.
  const row = isFlipped ? rank : 7 - rank;
  return {
    x: col * squareSize + squareSize / 2,
    y: row * squareSize + squareSize / 2,
  };
}
