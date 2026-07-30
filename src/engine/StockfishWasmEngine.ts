/**
 * Browser-side Stockfish client. The worker is serial, but each caller owns a
 * request id: aborting one caller never stops an unrelated queued request.
 */

import { Chess } from 'chess.js';
import type {
  ChessEngine,
  EngineAnalysis,
  EngineMove,
  EngineOpts,
  PlayOpts,
} from './ChessEngine';
import type { EngineWorkerRequest, EngineWorkerResponse } from './workerProtocol';

const READY_TIMEOUT_MS = 15_000;
const MIN_REQUEST_TIMEOUT_MS = 5_000;
const MAX_REQUEST_TIMEOUT_MS = 90_000;

type Pending<T> = {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  cleanup: () => void;
};

export type StockfishWasmEngineOptions = {
  readyTimeoutMs?: number;
  onFatal?: () => void;
};

function abortError(message: string): Error {
  return new DOMException(message, 'AbortError');
}

function clamp(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value!)));
}

function validateFen(fen: string): void {
  if (typeof fen !== 'string' || fen.length > 256) throw new Error('Invalid chess position.');
  try {
    new Chess(fen);
  } catch {
    throw new Error('Invalid chess position.');
  }
}

function requestTimeout(movetimeMs: number, depth?: number): number {
  // Scheduling headroom is bounded so a stuck worker cannot strand the UI.
  const budget = Math.max(movetimeMs, (depth ?? 0) * 500) + 5_000;
  return Math.max(MIN_REQUEST_TIMEOUT_MS, Math.min(MAX_REQUEST_TIMEOUT_MS, budget));
}

export class StockfishWasmEngine implements ChessEngine {
  readonly name = 'stockfish' as const;
  readonly ready: Promise<void>;

  private readonly worker: Worker;
  private readonly pendingAnalysis = new Map<string, Pending<EngineAnalysis>>();
  private readonly pendingMoves = new Map<string, Pending<EngineMove>>();
  private readonly readyTimeout: ReturnType<typeof setTimeout>;
  private resolveReady!: () => void;
  private rejectReady!: (reason: Error) => void;
  private isReady = false;
  private disposed = false;
  private fatalError: Error | null = null;
  private readonly onFatal?: () => void;

  constructor(options: StockfishWasmEngineOptions = {}) {
    this.onFatal = options.onFatal;
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.readyTimeout = setTimeout(() => {
      this.fail(new Error('Stockfish did not become ready in time.'));
    }, options.readyTimeoutMs ?? READY_TIMEOUT_MS);
    this.worker = new Worker(new URL('./stockfish-worker.ts', import.meta.url), { type: 'module' });
    this.worker.addEventListener('message', this.onMessage);
    this.worker.addEventListener('error', this.onWorkerError);
    this.post({ type: 'init' });
  }

  private post(message: EngineWorkerRequest): void {
    if (!this.disposed && !this.fatalError) this.worker.postMessage(message);
  }

  private settle<T>(map: Map<string, Pending<T>>, id: string, result: { value: T } | { error: Error }): void {
    const pending = map.get(id);
    if (!pending) return;
    map.delete(id);
    pending.cleanup();
    if ('value' in result) pending.resolve(result.value);
    else pending.reject(result.error);
  }

  private fail(error: Error): void {
    if (this.fatalError) return;
    this.fatalError = error;
    clearTimeout(this.readyTimeout);
    if (!this.isReady) this.rejectReady(error);
    for (const id of [...this.pendingAnalysis.keys()]) this.settle(this.pendingAnalysis, id, { error });
    for (const id of [...this.pendingMoves.keys()]) this.settle(this.pendingMoves, id, { error });
    this.onFatal?.();
  }

  private readonly onMessage = (event: MessageEvent<EngineWorkerResponse>): void => {
    const message = event.data;
    if (message.type === 'ready') {
      if (this.fatalError || this.disposed || this.isReady) return;
      this.isReady = true;
      clearTimeout(this.readyTimeout);
      this.resolveReady();
      return;
    }
    if (message.type === 'analysis') {
      this.settle(this.pendingAnalysis, message.id, { value: message.analysis });
      return;
    }
    if (message.type === 'move') {
      this.settle(this.pendingMoves, message.id, { value: { bestmove: message.bestmove } });
      return;
    }
    if (message.type === 'cancelled') {
      this.settle(this.pendingAnalysis, message.id, { error: abortError('Stockfish request cancelled.') });
      this.settle(this.pendingMoves, message.id, { error: abortError('Stockfish request cancelled.') });
      return;
    }
    if (message.id) {
      const error = new Error(message.message);
      this.settle(this.pendingAnalysis, message.id, { error });
      this.settle(this.pendingMoves, message.id, { error });
      return;
    }
    this.fail(new Error(message.message));
  };

  private readonly onWorkerError = (event: ErrorEvent): void => {
    this.fail(new Error(`Stockfish worker error: ${event.message || 'unknown worker failure'}`));
  };

  private async request<T>(
    kind: 'analyze' | 'play',
    fen: string,
    signal: AbortSignal | undefined,
    timeoutMs: number,
    message: EngineWorkerRequest,
    map: Map<string, Pending<T>>,
  ): Promise<T> {
    if (signal?.aborted) throw abortError(`${kind} aborted`);
    validateFen(fen);
    if (this.disposed) throw new Error('Stockfish engine has been disposed.');
    if (this.fatalError) throw this.fatalError;
    await this.ready;
    if (signal?.aborted) throw abortError(`${kind} aborted`);
    if (this.disposed) throw new Error('Stockfish engine has been disposed.');
    if (this.fatalError) throw this.fatalError;

    const id = 'id' in message ? message.id : crypto.randomUUID();
    return new Promise<T>((resolve, reject) => {
      const onAbort = (): void => {
        this.settle(map, id, { error: abortError(`${kind} aborted`) });
        this.post({ type: 'cancel', id });
      };
      const cleanup = (): void => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
      };
      const timeout = setTimeout(() => {
        this.settle(map, id, { error: new Error(`Stockfish ${kind} request timed out.`) });
        this.post({ type: 'cancel', id });
      }, timeoutMs);
      map.set(id, { resolve, reject, cleanup });
      signal?.addEventListener('abort', onAbort, { once: true });
      if (signal?.aborted) {
        onAbort();
        return;
      }
      this.post(message);
    });
  }

  analyze(fen: string, opts: EngineOpts): Promise<EngineAnalysis> {
    const id = crypto.randomUUID();
    const depth = clamp(opts.depth, 20, 1, 40);
    const multipv = clamp(opts.multipv, 3, 1, 10);
    const movetimeMs = opts.movetimeMs === undefined ? undefined : clamp(opts.movetimeMs, 1_000, 50, 60_000);
    return this.request(
      'analyze', fen, opts.signal, requestTimeout(movetimeMs ?? 0, depth),
      { type: 'analyze', id, fen, opts: { depth, multipv, movetimeMs, searchMovesSan: opts.searchMovesSan?.slice(0, 32) } },
      this.pendingAnalysis,
    );
  }

  play(fen: string, opts: PlayOpts): Promise<EngineMove> {
    const id = crypto.randomUUID();
    const elo = clamp(opts.elo, 1_500, 800, 3_190);
    const movetimeMs = opts.movetimeMs === undefined ? undefined : clamp(opts.movetimeMs, 400, 50, 60_000);
    return this.request(
      'play', fen, opts.signal, requestTimeout(movetimeMs ?? 400),
      { type: 'play', id, fen, elo, movetimeMs }, this.pendingMoves,
    );
  }

  stop(): void {
    if (this.disposed) return;
    const error = abortError('Stockfish stopped.');
    for (const id of [...this.pendingAnalysis.keys()]) this.settle(this.pendingAnalysis, id, { error });
    for (const id of [...this.pendingMoves.keys()]) this.settle(this.pendingMoves, id, { error });
    this.post({ type: 'stop' });
  }

  get usable(): boolean {
    return !this.disposed && !this.fatalError;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    clearTimeout(this.readyTimeout);
    const error = new Error('Stockfish engine has been disposed.');
    if (!this.isReady) this.rejectReady(error);
    for (const id of [...this.pendingAnalysis.keys()]) this.settle(this.pendingAnalysis, id, { error });
    for (const id of [...this.pendingMoves.keys()]) this.settle(this.pendingMoves, id, { error });
    this.worker.removeEventListener('message', this.onMessage);
    this.worker.removeEventListener('error', this.onWorkerError);
    this.worker.terminate();
    this.onFatal?.();
  }
}
