import { Chess } from 'chess.js';
import { loadStockfishEngine } from '../engine/engineLoader';
import { getEnginePreset } from '../engine/presets';
import type { EnginePresetName } from '../engine/presets';
import { getGameAnalysisRepository } from '../storage';
import type { GameAnalysis } from '../types/analysis';

export type AnalyzeGameInput = {
  gameId: string;
  pgn: string;
  enginePreset: EnginePresetName;
  maxPlies?: number;
};

type RunningJob = {
  promise: Promise<GameAnalysis>;
  input: AnalyzeGameInput;
  key: string;
  abort: AbortController;
  reject: (e: unknown) => void;
};

type QueueItem = {
  key: string;
  run: () => Promise<void>;
};

/**
 * Phase 5 substrate queue.
 *
 * - Coalesces duplicate in-flight requests by `(gameId, enginePreset)`
 * - Runs jobs serially (one Stockfish analysis pipeline at a time)
 * - Persists results to `game_analysis` cache
 * - Supports cancellation by key
 */
export class GameAnalysisQueue {
  private readonly running = new Map<string, RunningJob>();
  private readonly pending: QueueItem[] = [];
  private draining = false;

  private key(gameId: string, enginePreset: string): string {
    return `${gameId}::${enginePreset}`;
  }

  async enqueue(input: AnalyzeGameInput): Promise<GameAnalysis> {
    const k = this.key(input.gameId, input.enginePreset);
    const already = this.running.get(k);
    if (already) return already.promise;

    const repo = getGameAnalysisRepository();
    const cached = await repo.get(input.gameId, input.enginePreset);
    if (cached) return cached;

    // Cache reads are asynchronous. A matching call can have reached this
    // point while we awaited the repository, so re-check single-flight state.
    const joined = this.running.get(k);
    if (joined) return joined.promise;

    const abort = new AbortController();
    let resolve!: (r: GameAnalysis) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<GameAnalysis>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    this.running.set(k, { promise, input, key: k, abort, reject });

    this.pending.push({
      key: k,
      run: async () => {
      try {
        const analyzed = await this.runOne(input, abort.signal);
        await repo.put(analyzed);
        resolve(analyzed);
      } catch (e) {
        reject(e);
      } finally {
        this.running.delete(k);
      }
      },
    });
    void this.drain();
    return promise;
  }

  cancel(gameId: string, enginePreset: EnginePresetName): void {
    const k = this.key(gameId, enginePreset);
    const running = this.running.get(k);
    if (!running) return;
    running.abort.abort();
    const idx = this.pending.findIndex((job) => job.key === k);
    if (idx >= 0) {
      this.pending.splice(idx, 1);
      running.reject(new DOMException('analysis aborted', 'AbortError'));
      this.running.delete(k);
    }
  }

  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.pending.length > 0) {
        const job = this.pending.shift();
        if (job) await job.run();
      }
    } finally {
      this.draining = false;
    }
  }

  private async runOne(input: AnalyzeGameInput, signal: AbortSignal): Promise<GameAnalysis> {
    const board = new Chess();
    board.loadPgn(input.pgn);
    const sans = board.history();
    const max = Math.min(input.maxPlies ?? sans.length, sans.length);
    const playback = new Chess();
    const sf = await loadStockfishEngine();
    const opts = { ...getEnginePreset(input.enginePreset), signal };

    const plies: Array<Record<string, unknown>> = [];
    for (let i = 0; i < max; i += 1) {
      if (signal.aborted) throw new DOMException('analysis aborted', 'AbortError');
      const san = sans[i]!;
      const fenBefore = playback.fen();
      const best = await sf.analyze(fenBefore, opts);
      playback.move(san);
      const fenAfter = playback.fen();
      const playedLine = await sf.analyze(fenAfter, opts);
      const bestCp = best.pvs[0]?.scoreCp ?? 0;
      const playedCp = -(playedLine.pvs[0]?.scoreCp ?? 0);
      plies.push({
        plyIndex: i,
        san,
        fenBefore,
        fenAfter,
        bestmove: best.bestmove,
        cpLoss: bestCp - playedCp,
      });
    }

    const now = Date.now();
    return {
      gameId: input.gameId,
      enginePreset: input.enginePreset,
      createdAt: now,
      updatedAt: now,
      plies,
    };
  }
}

let singleton: GameAnalysisQueue | null = null;
export function getGameAnalysisQueue(): GameAnalysisQueue {
  if (!singleton) singleton = new GameAnalysisQueue();
  return singleton;
}

export function _setGameAnalysisQueueForTesting(q: GameAnalysisQueue | null): void {
  singleton = q;
}
