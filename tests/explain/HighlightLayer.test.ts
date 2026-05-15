/**
 * deriveHighlightStyles — pure derivation tests (Article 15 single primitive).
 */

import { describe, expect, it } from 'vitest';
import { deriveHighlightStyles } from '../../src/ui/board/HighlightLayer';

describe('deriveHighlightStyles — spotlight mode (Explain)', () => {
  it('empty squares → inactive', () => {
    const r = deriveHighlightStyles({ mode: 'spotlight', squares: [] });
    expect(r.active).toBe(false);
    expect(r.pieceOpacity).toBe(1);
  });

  it('intent=focus produces a blue-ish glow style', () => {
    const r = deriveHighlightStyles({
      mode: 'spotlight',
      squares: [{ square: 'd5', intent: 'focus' }],
    });
    expect(r.active).toBe(true);
    expect(r.squareStyles.d5?.backgroundColor).toContain('80, 160, 255');
  });

  it('intent=threat produces a red-ish glow', () => {
    const r = deriveHighlightStyles({
      mode: 'spotlight',
      squares: [{ square: 'f7', intent: 'threat' }],
    });
    expect(r.squareStyles.f7?.backgroundColor).toContain('220, 60, 70');
  });

  it('intent=support produces a green-ish glow', () => {
    const r = deriveHighlightStyles({
      mode: 'spotlight',
      squares: [{ square: 'c3', intent: 'support' }],
    });
    expect(r.squareStyles.c3?.backgroundColor).toContain('70, 200, 130');
  });

  it('no intent → neutral amber glow', () => {
    const r = deriveHighlightStyles({
      mode: 'spotlight',
      squares: [{ square: 'e4' }],
    });
    expect(r.squareStyles.e4?.backgroundColor).toContain('255, 200, 60');
  });
});

describe('deriveHighlightStyles — bright mode (Pattern Viz, Phase 2)', () => {
  it('fadePieces=true sets pieceOpacity < 1', () => {
    const r = deriveHighlightStyles({
      mode: 'bright',
      squares: [{ square: 'd5', side: 'white' }],
      fadePieces: true,
    });
    expect(r.pieceOpacity).toBeLessThan(1);
  });
});
