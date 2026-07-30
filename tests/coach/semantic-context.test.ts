import { describe, expect, it } from 'vitest';
import { extractSemanticContext, renderSemanticBlock } from '../../src/coach/semantic/extractSemanticContext';
import type { EngineAnalysis } from '../../src/engine/ChessEngine';

const baseEngine = (bestmove: string, pv: string[]): EngineAnalysis => ({
  fen: 'x',
  bestmove,
  pvs: [{ moves: pv, scoreCp: 24, depth: 20 }],
  engineName: 'Stockfish',
  engineDepth: 20,
});

describe('extractSemanticContext', () => {
  it('classifies castle + king safety', () => {
    const s = extractSemanticContext(baseEngine('O-O', ['O-O', 'Nf6', 'Re1']));
    expect(s.purposes).toContain('castle');
    expect(s.purposes).toContain('improve-king-safety');
    expect(s.shortPlan[0]).toContain('O-O');
  });

  it('classifies central break and capture/check', () => {
    const s = extractSemanticContext(baseEngine('dxe5+', ['dxe5+', 'Nxe5']));
    expect(s.purposes).toContain('capture');
    expect(s.purposes).toContain('check');
    expect(s.purposes).toContain('central-break');
  });

  it('renders semantic block', () => {
    const block = renderSemanticBlock({
      purposes: ['develop', 'central-break'],
      shortPlan: ['Best line starts with e4.', 'Likely reply: e5.'],
    });
    expect(block).toContain('MOVE PURPOSE TAGS');
    expect(block).toContain('develop, central-break');
  });
});
