/**
 * StockfishWasmEngine — the concrete `ChessEngine` (Phase 4a, Design §1).
 *
 * Owns a single Web Worker running stockfish.wasm. Concurrent `analyze` calls
 * are tracked by a UUID correlation map and resolved independently; the worker
 * runs them sequentially but callers each get their own promise. `stop()` is
 * idempotent. A worker that never finishes its handshake surfaces as a rejected
 * `ready` promise, not a crash (Article 11).
 *
 * Article 9 — only SAN crosses this boundary; UCI lives in the worker.
 */

import type {
  ChessEngine,
  EngineAnalysis,
  EngineMove,
  EngineOpts,
  PlayOpts,
} from './ChessEngine';

type ReadyMsg = { type: 'ready' };
type AnalysisMsg = { type: 'analysis'; id: string; analysis: EngineAnalysis };
type MoveMsg = { type: 'move'; id: string; bestmove: string };
type ErrorMsg = { type: 'error'; id?: string; message: string };
type WorkerMsg = ReadyMsg | AnalysisMsg | MoveMsg | ErrorMsg;

type Pending = {
  resolve: (a: EngineAnalysis) => void;
  reject: (e: Error) => void;
};

type PendingMove = {
  resolve: (m: EngineMove) => void;
  reject: (e: Error) => void;
};

export class StockfishWasmEngine implements ChessEngine {
  readonly name = 'stockfish' as const;
  readonly ready: Promise<void>;

  private readonly worker: Worker;
  private readonly pending = new Map<string, Pending>();
  private readonly pendingMoves = new Map<string, PendingMove>();
  private resolveReady!: () => void;
  private rejectReady!: (e: Error) => void;
  private isReady = false;

  constructor() {
    this.ready = new Promise<void>((res, rej) => {
      this.resolveReady = res;
      this.rejectReady = rej;
    });

    this.worker = new Worker(new URL('./stockfish-worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.addEventListener('message', this.onMessage);
    this.worker.addEventListener('error', this.onWorkerError);
    this.worker.postMessage({ type: 'init' });
  }

  private readonly onMessage = (e: MessageEvent<WorkerMsg>): void => {
    const msg = e.data;
    if (msg.type === 'ready') {
      this.isReady = true;
      this.resolveReady();
      return;
    }
    if (msg.type === 'analysis') {
      const p = this.pending.get(msg.id);
      if (p) {
        this.pending.delete(msg.id);
        p.resolve(msg.analysis);
      }
      return;
    }
    if (msg.type === 'move') {
      const p = this.pendingMoves.get(msg.id);
      if (p) {
        this.pendingMoves.delete(msg.id);
        p.resolve({ bestmove: msg.bestmove });
      }
      return;
    }
    if (msg.type === 'error') {
      if (msg.id) {
        const p = this.pending.get(msg.id);
        if (p) {
          this.pending.delete(msg.id);
          p.reject(new Error(msg.message));
        }
        const pm = this.pendingMoves.get(msg.id);
        if (pm) {
          this.pendingMoves.delete(msg.id);
          pm.reject(new Error(msg.message));
        }
      } else if (!this.isReady) {
        // Load-time failure before handshake — fail the ready promise so the
        // pipeline can render the engine-unavailable state.
        this.rejectReady(new Error(msg.message));
      }
      return;
    }
  };

  private readonly onWorkerError = (e: ErrorEvent): void => {
    const err = new Error(`stockfish worker error: ${e.message}`);
    if (!this.isReady) this.rejectReady(err);
    for (const [id, p] of this.pending) {
      this.pending.delete(id);
      p.reject(err);
    }
    for (const [id, p] of this.pendingMoves) {
      this.pendingMoves.delete(id);
      p.reject(err);
    }
  };

  async analyze(fen: string, opts: EngineOpts): Promise<EngineAnalysis> {
    await this.ready;
    const id = crypto.randomUUID();
    const promise = new Promise<EngineAnalysis>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });

    if (opts.signal) {
      const onAbort = (): void => {
        const p = this.pending.get(id);
        if (p) {
          this.pending.delete(id);
          p.reject(new DOMException('analyze aborted', 'AbortError'));
        }
        this.stop();
      };
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    this.worker.postMessage({
      type: 'analyze',
      id,
      fen,
      opts: { depth: opts.depth, multipv: opts.multipv, movetimeMs: opts.movetimeMs },
    });
    return promise;
  }

  async play(fen: string, opts: PlayOpts): Promise<EngineMove> {
    await this.ready;
    const id = crypto.randomUUID();
    const promise = new Promise<EngineMove>((resolve, reject) => {
      this.pendingMoves.set(id, { resolve, reject });
    });

    if (opts.signal) {
      const onAbort = (): void => {
        const p = this.pendingMoves.get(id);
        if (p) {
          this.pendingMoves.delete(id);
          p.reject(new DOMException('play aborted', 'AbortError'));
        }
        this.stop();
      };
      if (opts.signal.aborted) onAbort();
      else opts.signal.addEventListener('abort', onAbort, { once: true });
    }

    this.worker.postMessage({
      type: 'play',
      id,
      fen,
      elo: opts.elo,
      movetimeMs: opts.movetimeMs,
    });
    return promise;
  }

  stop(): void {
    this.worker.postMessage({ type: 'stop' });
  }

  /** Tear down the worker. Not part of the interface; used by tests/HMR. */
  dispose(): void {
    this.worker.terminate();
    this.pending.clear();
    this.pendingMoves.clear();
  }
}
