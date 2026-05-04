/**
 * KeySquareOverlay — pure derivation tests.
 *
 * Component scaffold lives in src/ui/KeySquareOverlay.tsx; this file tests
 * the pure `deriveKeySquareStyles` config → style record function. Phase 2
 * will add render-time tests once the overlay is wired into DrillPage.
 */

import { describe, expect, it } from 'vitest';
import { deriveKeySquareStyles } from '../src/ui/KeySquareOverlay';

describe('deriveKeySquareStyles', () => {
  it('returns inactive result for empty keySquares', () => {
    const r = deriveKeySquareStyles({ keySquares: [] });
    expect(r.active).toBe(false);
    expect(r.squareStyles).toEqual({});
    expect(r.pieceOpacity).toBe(1);
  });

  it('returns active result with one entry per key square', () => {
    const r = deriveKeySquareStyles({
      keySquares: [
        { square: 'd5', note: 'central light square' },
        { square: 'f5', note: 'kingside lever', side: 'black' },
      ],
    });
    expect(r.active).toBe(true);
    expect(Object.keys(r.squareStyles)).toEqual(['d5', 'f5']);
    expect(r.squareStyles.d5?.backgroundColor).toContain('rgba');
    expect(r.squareStyles.f5?.backgroundColor).toContain('rgba');
  });

  it('applies fadePieces opacity when flag set', () => {
    const r = deriveKeySquareStyles({
      keySquares: [{ square: 'd5' }],
      fadePieces: true,
    });
    expect(r.pieceOpacity).toBe(0.22);
  });

  it('keeps pieceOpacity 1 when fadePieces off', () => {
    const r = deriveKeySquareStyles({
      keySquares: [{ square: 'd5' }],
      fadePieces: false,
    });
    expect(r.pieceOpacity).toBe(1);
  });

  it('color-codes by side', () => {
    const white = deriveKeySquareStyles({
      keySquares: [{ square: 'd5', side: 'white' }],
    }).squareStyles.d5?.backgroundColor;
    const black = deriveKeySquareStyles({
      keySquares: [{ square: 'd5', side: 'black' }],
    }).squareStyles.d5?.backgroundColor;
    const both = deriveKeySquareStyles({
      keySquares: [{ square: 'd5', side: 'both' }],
    }).squareStyles.d5?.backgroundColor;
    const undef = deriveKeySquareStyles({
      keySquares: [{ square: 'd5' }],
    }).squareStyles.d5?.backgroundColor;

    expect(white).not.toBe(black);
    expect(both).toBe(undef); // both === undefined → same gold
    expect(white).not.toBe(both);
  });

  it('multiple squares with mixed sides keep distinct colors', () => {
    const r = deriveKeySquareStyles({
      keySquares: [
        { square: 'd5', side: 'white' },
        { square: 'f5', side: 'black' },
      ],
    });
    expect(r.squareStyles.d5?.backgroundColor).not.toBe(
      r.squareStyles.f5?.backgroundColor
    );
  });
});
