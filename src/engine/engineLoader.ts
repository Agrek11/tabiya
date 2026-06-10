/**
 * engineLoader — lazy, singleton access to the Stockfish engine (Task 3.3).
 *
 * `loadStockfishEngine()` dynamically imports `StockfishWasmEngine` so Vite
 * emits it (and the bundled engine glue) as a SEPARATE chunk that is fetched
 * only on the first Coach invocation — keeping the base trainer bundle light
 * (Article 11, R9.7). The resolved engine is cached for the session.
 *
 * Surfaces depend on this loader + the `ChessEngine` interface, never the
 * concrete class (Article 5).
 */

import type { ChessEngine } from './ChessEngine';

let enginePromise: Promise<ChessEngine> | null = null;

export function loadStockfishEngine(): Promise<ChessEngine> {
  if (!enginePromise) {
    enginePromise = import('./StockfishWasmEngine')
      .then(({ StockfishWasmEngine }) => {
        const engine = new StockfishWasmEngine();
        // Surface a handshake failure as a rejected load so the singleton is
        // not poisoned by a permanently-pending engine.
        return engine.ready.then(() => engine);
      })
      .catch((err) => {
        enginePromise = null; // allow a later retry (e.g. user reloads modal)
        throw err;
      });
  }
  return enginePromise;
}

/** Test-only: reset the singleton between cases. */
export function _resetEngineForTesting(): void {
  enginePromise = null;
}
