/**
 * Contract-harness self-test — Task 11.2.
 *
 * Validates `runChessEngineContract` against an in-memory `FakeEngine`, so the
 * reusable suite (tests/engine/chessEngineContract.ts) cannot silently rot.
 * Concrete engines invoke the same suite from their own test files.
 */

import type { ChessEngine, EngineAnalysis, EngineOpts } from '../../src/engine/ChessEngine';
import { runChessEngineContract } from './chessEngineContract';

class FakeEngine implements ChessEngine {
  readonly name = 'stockfish' as const;
  readonly ready = Promise.resolve();

  async analyze(fen: string, opts: EngineOpts): Promise<EngineAnalysis> {
    const pvs = Array.from({ length: opts.multipv ?? 1 }, (_, i) => ({
      moves: i === 0 ? ['e4', 'e5', 'Nf3'] : ['d4', 'd5'],
      scoreCp: 30 - i * 5,
      depth: opts.depth ?? 12,
    }));
    return {
      fen,
      bestmove: pvs[0].moves[0],
      pvs,
      engineName: 'FakeEngine 1',
      engineDepth: opts.depth ?? 12,
    };
  }

  stop(): void {
    /* idempotent no-op */
  }
}

runChessEngineContract('FakeEngine (harness self-test)', () => new FakeEngine());
