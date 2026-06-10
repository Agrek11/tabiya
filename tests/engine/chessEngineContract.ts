/**
 * Reusable ChessEngine contract suite — Task 11.2 (Article 5).
 *
 * Any concrete engine (today `StockfishWasmEngine`, tomorrow a `LeelaEngine`)
 * passes the same shape guarantees with a single `runChessEngineContract`
 * call. SAN-only at the boundary (Article 9) is asserted structurally on every
 * PV move. Not a test file itself — imported by *.contract.test.ts and by each
 * concrete engine's suite.
 */

import { describe, expect, it } from 'vitest';
import type { ChessEngine, EngineName, EngineOpts } from '../../src/engine/ChessEngine';

const ENGINE_NAMES: EngineName[] = ['stockfish', 'leela'];

/** Loose SAN shape — "Nf3", "exd5", "O-O", "e8=Q+", "Qxf7#". NOT UCI ("g1f3"). */
export const SAN_RE = /^(O-O(-O)?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](=[QRBN])?)[+#]?$/;

export function runChessEngineContract(
  engineLabel: string,
  factory: () => ChessEngine,
  opts: EngineOpts = { depth: 12, multipv: 3 },
): void {
  describe(`ChessEngine contract — ${engineLabel}`, () => {
    it('exposes a name from the EngineName union', () => {
      const engine = factory();
      expect(ENGINE_NAMES).toContain(engine.name);
    });

    it('ready resolves', async () => {
      const engine = factory();
      await expect(engine.ready).resolves.toBeUndefined();
    });

    it('analyze returns a shape-conformant, SAN-only EngineAnalysis', async () => {
      const engine = factory();
      await engine.ready;
      const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
      const analysis = await engine.analyze(fen, opts);

      expect(analysis.fen).toBe(fen);
      expect(typeof analysis.engineName).toBe('string');
      expect(analysis.engineDepth).toBeGreaterThan(0);
      expect(analysis.pvs.length).toBeGreaterThan(0);
      expect(analysis.bestmove).toBe(analysis.pvs[0].moves[0]);

      for (const pv of analysis.pvs) {
        expect(pv.moves.length).toBeGreaterThan(0);
        expect(Number.isFinite(pv.scoreCp)).toBe(true);
        expect(pv.depth).toBeGreaterThan(0);
        for (const move of pv.moves) {
          expect(move).toMatch(SAN_RE);
        }
      }
    });

    it('stop() is callable and idempotent', async () => {
      const engine = factory();
      await engine.ready;
      expect(() => {
        engine.stop();
        engine.stop();
      }).not.toThrow();
    });
  });
}
