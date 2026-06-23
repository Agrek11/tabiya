import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { annotateExplainPly } from '../../src/coach/explain/moveAnnotator';

/** Replay a SAN line, annotating each ply with no sidecar features. */
function annotateLine(moves: string[]): string[] {
  const board = new Chess();
  const out: string[] = [];
  for (let i = 0; i < moves.length; i++) {
    const fenBefore = board.fen();
    out.push(
      annotateExplainPly({ fenBefore, san: moves[i]!, plyIndex: i, featuresAfter: null })
        .rationale,
    );
    board.move(moves[i]!);
  }
  return out;
}

describe('moveAnnotator', () => {
  it('annotates the Italian Giuoco Pianissimo with grounded move semantics', () => {
    const lines = annotateLine([
      'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
    ]);
    expect(lines[0]).toBe('1. e4 — stakes a claim in the center.');
    expect(lines[2]).toContain('develops the knight');
    expect(lines[2]).toContain('e5'); // Nf3 attacks the e5 pawn
    expect(lines[4]).toContain('develops the bishop');
    expect(lines[4]).toContain('f7'); // Bc4 eyes f7
    expect(lines[10]).toContain('castles kingside');
  });

  it('reports captures and check concretely', () => {
    // Scholar's-mate-ish: Qxf7 is mate (capture + check).
    const board = new Chess();
    for (const m of ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6']) board.move(m);
    const block = annotateExplainPly({
      fenBefore: board.fen(),
      san: 'Qxf7#',
      plyIndex: 6,
      featuresAfter: null,
    });
    expect(block.rationale).toContain('capturing the pawn on f7');
    expect(block.rationale).toContain('with check');
    expect(block.arrows?.[0]).toMatchObject({ from: 'h5', to: 'f7', color: 'green' });
  });
});
