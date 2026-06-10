/**
 * StockfishWasmEngine — Task 11.1.
 *
 * Two layers:
 *
 *  1. Unit tests with a stubbed Worker — the engine's real logic (id
 *     correlation, abort wiring, ready failure, stop idempotency) lives on the
 *     main-thread side and is fully verifiable in jsdom.
 *
 *  2. Real-wasm integration on 5 known FENs (R9.1) — stockfish.wasm needs a
 *     browser Worker + SharedArrayBuffer, which jsdom does not provide, so the
 *     suite is gated and runs in a real browser (manual smoke / future
 *     vitest browser mode). The contract assertions are shared with
 *     ChessEngine.contract.test.ts so the gate hides no unique logic.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EngineAnalysis } from '../../src/engine/ChessEngine';
import { StockfishWasmEngine } from '../../src/engine/StockfishWasmEngine';
import { runChessEngineContract } from './chessEngineContract';

// --- Worker stub -------------------------------------------------------------

type Listener = (e: MessageEvent | ErrorEvent) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  posted: Array<Record<string, unknown>> = [];
  terminated = false;
  private listeners = new Map<string, Set<Listener>>();

  constructor() {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, fn: Listener): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }
  removeEventListener(type: string, fn: Listener): void {
    this.listeners.get(type)?.delete(fn);
  }
  postMessage(msg: Record<string, unknown>): void {
    this.posted.push(msg);
  }
  terminate(): void {
    this.terminated = true;
  }

  /** Test helper — emit a message from the "worker" side. */
  emit(data: unknown): void {
    for (const fn of this.listeners.get('message') ?? []) {
      fn({ data } as MessageEvent);
    }
  }
  emitError(message: string): void {
    for (const fn of this.listeners.get('error') ?? []) {
      fn({ message } as ErrorEvent);
    }
  }
}

const ANALYSIS = (fen: string): EngineAnalysis => ({
  fen,
  bestmove: 'e4',
  pvs: [{ moves: ['e4', 'e5'], scoreCp: 30, depth: 12 }],
  engineName: 'Stockfish 16',
  engineDepth: 12,
});

beforeEach(() => {
  FakeWorker.instances = [];
  vi.stubGlobal('Worker', FakeWorker);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

function readyEngine(): { engine: StockfishWasmEngine; worker: FakeWorker } {
  const engine = new StockfishWasmEngine();
  const worker = FakeWorker.instances.at(-1)!;
  worker.emit({ type: 'ready' });
  return { engine, worker };
}

describe('StockfishWasmEngine (stubbed worker)', () => {
  it('posts init on construction and resolves ready on the handshake reply', async () => {
    const { engine, worker } = readyEngine();
    expect(worker.posted[0]).toEqual({ type: 'init' });
    await expect(engine.ready).resolves.toBeUndefined();
  });

  it('correlates concurrent analyze calls by id, resolving out of order', async () => {
    const { engine, worker } = readyEngine();

    const a = engine.analyze('fen-a', { depth: 12 });
    const b = engine.analyze('fen-b', { depth: 12 });
    // Let the queued `await this.ready` continuations post their messages.
    await Promise.resolve();

    const [msgA, msgB] = worker.posted.slice(1) as Array<{ id: string; fen: string }>;
    expect(msgA.fen).toBe('fen-a');
    expect(msgB.fen).toBe('fen-b');
    expect(msgA.id).not.toBe(msgB.id);

    // Resolve B first — A must stay pending and keep its own result.
    worker.emit({ type: 'analysis', id: msgB.id, analysis: ANALYSIS('fen-b') });
    await expect(b).resolves.toMatchObject({ fen: 'fen-b' });

    worker.emit({ type: 'analysis', id: msgA.id, analysis: ANALYSIS('fen-a') });
    await expect(a).resolves.toMatchObject({ fen: 'fen-a' });
  });

  it('rejects an aborted analyze with AbortError and posts stop', async () => {
    const { engine, worker } = readyEngine();
    const ctrl = new AbortController();

    const p = engine.analyze('fen-a', { depth: 12, signal: ctrl.signal });
    await Promise.resolve();
    ctrl.abort();

    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(worker.posted.at(-1)).toEqual({ type: 'stop' });
  });

  it('an already-aborted signal rejects immediately', async () => {
    const { engine } = readyEngine();
    const ctrl = new AbortController();
    ctrl.abort();
    await expect(engine.analyze('fen-a', { depth: 12, signal: ctrl.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
  });

  it('a pre-handshake worker error rejects ready (engine-unavailable path)', async () => {
    const engine = new StockfishWasmEngine();
    const worker = FakeWorker.instances.at(-1)!;
    worker.emitError('wasm fetch failed');
    await expect(engine.ready).rejects.toThrow(/wasm fetch failed/);
  });

  it('a per-job error message rejects only that job', async () => {
    const { engine, worker } = readyEngine();
    const a = engine.analyze('bad-fen', { depth: 12 });
    const b = engine.analyze('fen-b', { depth: 12 });
    await Promise.resolve();

    const [msgA, msgB] = worker.posted.slice(1) as Array<{ id: string }>;
    worker.emit({ type: 'error', id: msgA.id, message: 'invalid fen' });
    await expect(a).rejects.toThrow('invalid fen');

    worker.emit({ type: 'analysis', id: msgB.id, analysis: ANALYSIS('fen-b') });
    await expect(b).resolves.toMatchObject({ fen: 'fen-b' });
  });

  it('stop() is idempotent', () => {
    const { engine } = readyEngine();
    expect(() => {
      engine.stop();
      engine.stop();
    }).not.toThrow();
  });
});

// --- Real-wasm integration (R9.1) — browser-only ------------------------------
//
// stockfish.wasm requires a real Worker + SharedArrayBuffer (COOP/COEP), which
// jsdom lacks. When run under vitest browser mode (or any environment that
// provides both), the gate opens and the 5-FEN suite runs against the real
// engine. Until then the canonical real-engine verification is the manual
// smoke in evals/coach/4a-walkthrough.md (Task 11.10).

const hasRealWasmRuntime =
  typeof SharedArrayBuffer !== 'undefined' &&
  typeof globalThis.Worker !== 'undefined' &&
  !(globalThis.Worker as unknown as { instances?: unknown }).instances && // not our stub
  typeof document !== 'undefined' &&
  !navigator.userAgent.includes('jsdom');

const KNOWN_FENS: Array<[string, string]> = [
  ['starting position', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'],
  ['Italian after 3.Bc4', 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3'],
  ['Sicilian after 2...d6', 'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3'],
  ['French Tarrasch', 'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR b KQkq - 1 3'],
  ['Caro-Kann Advance', 'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3'],
];

describe.runIf(hasRealWasmRuntime)('StockfishWasmEngine (real wasm, 5 FENs)', () => {
  it.each(KNOWN_FENS)(
    '%s returns ≥3 valid-SAN PVs at depth ≥18',
    async (_label, fen) => {
      const engine = new StockfishWasmEngine();
      await engine.ready;
      const analysis = await engine.analyze(fen, { depth: 20, multipv: 3 });
      expect(analysis.pvs.length).toBeGreaterThanOrEqual(3);
      expect(analysis.engineDepth).toBeGreaterThanOrEqual(18);
      expect(Number.isFinite(analysis.pvs[0].scoreCp)).toBe(true);
      engine.dispose();
    },
    30_000,
  );
});

// Contract suite (Task 11.2) against the stubbed engine: auto-resolve jobs.
runChessEngineContract('StockfishWasmEngine (stubbed worker)', () => {
  const engine = new StockfishWasmEngine();
  const worker = FakeWorker.instances.at(-1)!;
  worker.emit({ type: 'ready' });
  // Auto-answer every analyze with a canned SAN analysis.
  const origPost = worker.postMessage.bind(worker);
  worker.postMessage = (msg: Record<string, unknown>) => {
    origPost(msg);
    if (msg.type === 'analyze') {
      const { id, fen, opts } = msg as { id: string; fen: string; opts: { depth?: number; multipv?: number } };
      queueMicrotask(() =>
        worker.emit({
          type: 'analysis',
          id,
          analysis: {
            fen,
            bestmove: 'e4',
            pvs: Array.from({ length: opts.multipv ?? 1 }, (_, i) => ({
              moves: i === 0 ? ['e4', 'e5', 'Nf3'] : ['d4', 'd5'],
              scoreCp: 30 - i,
              depth: opts.depth ?? 12,
            })),
            engineName: 'Stockfish 16',
            engineDepth: opts.depth ?? 12,
          },
        }),
      );
    }
  };
  return engine;
});
