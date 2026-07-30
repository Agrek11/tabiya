/**
 * stockfish-worker.ts — the engine Web Worker entry (Phase 4a, Design §1).
 *
 * This is the ONLY file that touches UCI (Article 9). It loads stockfish.wasm,
 * drives the UCI handshake, parses `info`/`bestmove`, converts every PV from
 * UCI to SAN with an in-worker chess.js instance, and emits a SAN-only
 * `EngineAnalysis` back to the main thread. The main thread never sees a UCI
 * string.
 *
 * Loading: the Emscripten glue (`stockfish.wasm` → `stockfish.js`) is a UMD
 * module bundled by Vite; its sibling `.wasm` + pthread worker are served from
 * `/stockfish/` (copied into public/). `locateFile` pins that path so it
 * resolves correctly inside a worker (no `document` to infer a script dir).
 *
 * The engine can only run one search at a time (niklasf's build hangs if a
 * second `go` arrives mid-search), so jobs are queued and run sequentially;
 * `stop` cancels the queue and the in-flight search.
 */

import { Chess } from 'chess.js';
import Stockfish, { type StockfishInstance } from 'stockfish.wasm';
import type { EngineAnalysis, EnginePv } from './ChessEngine';
import type { EngineWorkerRequest, EngineWorkerResponse } from './workerProtocol';

// --- message protocol (mirrored in StockfishWasmEngine) --------------------

type InboundMsg = EngineWorkerRequest;
type OutboundMsg = EngineWorkerResponse;

const ctx = self as unknown as Worker;
function post(msg: OutboundMsg): void {
  ctx.postMessage(msg);
}

// --- engine lifecycle ------------------------------------------------------

let engine: StockfishInstance | null = null;
let engineName = 'Stockfish';

type Job = {
  id: string;
  kind: 'analyze' | 'play';
  fen: string;
  depth: number;
  multipv: number;
  movetimeMs?: number;
  /** Optional SAN move restriction for analyze jobs. */
  searchMovesSan?: string[];
  /** Target Elo for 'play' jobs. */
  elo?: number;
  cancelled?: boolean;
  cancellationNotified?: boolean;
};

const queue: Job[] = [];
let running: Job | null = null;

/** Accumulates the latest `info` line per multipv index for the running job. */
let pvByIndex: Map<number, EnginePv> = new Map();
let seenDepth = 0;

async function initEngine(): Promise<void> {
  if (engine) {
    post({ type: 'ready' });
    return;
  }
  try {
    engine = await Stockfish({
      locateFile: (path: string) => `/stockfish/${path}`,
    });
    engine.addMessageListener(onLine);
    engine.postMessage('uci');
    // 'ready' is posted to the main thread once we see `readyok` (see onLine).
  } catch (err) {
    post({ type: 'error', message: `engine load failed: ${String(err)}` });
  }
}

// --- UCI parsing -----------------------------------------------------------

function onLine(line: string): void {
  if (line.startsWith('id name ')) {
    engineName = line.slice('id name '.length).trim();
    return;
  }
  if (line === 'uciok') {
    engine?.postMessage('isready');
    return;
  }
  if (line === 'readyok') {
    post({ type: 'ready' });
    return;
  }
  if (line.startsWith('info ') && line.includes(' pv ') && line.includes('multipv')) {
    parseInfo(line);
    return;
  }
  if (line.startsWith('bestmove')) {
    if (running?.kind === 'play') finishPlay(line);
    else finishJob();
    return;
  }
}

/** Resolve a 'play' job from the `bestmove <uci>` line → SAN move. */
function finishPlay(line: string): void {
  const job = running;
  if (!job) return;
  if (job.cancelled) {
    finishCancelled(job);
    return;
  }
  const uci = line.split(/\s+/)[1];
  let bestmove = '';
  if (uci && uci !== '(none)') bestmove = uciLineToSan(job.fen, [uci])[0] ?? '';
  post({ type: 'move', id: job.id, bestmove });
  running = null;
  pvByIndex = new Map();
  seenDepth = 0;
  drain();
}

/** Parse one `info ... multipv K ... score cp|mate V ... pv m1 m2 ...` line. */
function parseInfo(line: string): void {
  const tokens = line.split(/\s+/);
  let depth = 0;
  let multipv = 1;
  let scoreCp = 0;
  let mateIn: number | undefined;
  let pvUci: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === 'depth') depth = Number(tokens[i + 1]);
    else if (tok === 'multipv') multipv = Number(tokens[i + 1]);
    else if (tok === 'score') {
      const kind = tokens[i + 1];
      const val = Number(tokens[i + 2]);
      if (kind === 'cp') scoreCp = val;
      else if (kind === 'mate') {
        mateIn = val;
        // Represent mate as a large signed cp so downstream sorting/coloring
        // still works; the explicit mateIn field carries the truth.
        scoreCp = val > 0 ? 100000 - val : -100000 - val;
      }
    } else if (tok === 'pv') {
      pvUci = tokens.slice(i + 1);
      break;
    }
  }

  if (pvUci.length === 0) return;
  seenDepth = Math.max(seenDepth, depth);
  pvByIndex.set(multipv, {
    moves: uciLineToSan(running!.fen, pvUci),
    scoreCp,
    mateIn,
    depth,
  });
}

/** Replay a UCI move list from `fen` and return the SAN sequence. */
function uciLineToSan(fen: string, uciMoves: string[]): string[] {
  const board = new Chess(fen);
  const san: string[] = [];
  for (const uci of uciMoves) {
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const promotion = uci.length > 4 ? uci.slice(4, 5) : undefined;
    try {
      const move = board.move({ from, to, promotion });
      san.push(move.san);
    } catch {
      // Defensive: a malformed/late PV token — stop converting this line.
      break;
    }
  }
  return san;
}

/** Convert SAN moves to UCI moves from `fen`; invalid SANs are skipped. */
function sanToUciMoves(fen: string, sans: string[]): string[] {
  const board = new Chess(fen);
  const out: string[] = [];
  for (const san of sans) {
    try {
      const mv = board.move(san);
      out.push(`${mv.from}${mv.to}${mv.promotion ?? ''}`);
      board.undo();
    } catch {
      // ignore invalid SAN entries for this position
    }
  }
  return out;
}

function finishJob(): void {
  const job = running;
  if (!job) return;
  if (job.cancelled) {
    finishCancelled(job);
    return;
  }

  const pvs = [...pvByIndex.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, pv]) => pv)
    .filter((pv) => pv.moves.length > 0);

  const analysis: EngineAnalysis = {
    fen: job.fen,
    bestmove: pvs[0]?.moves[0] ?? '',
    pvs,
    engineName,
    engineDepth: seenDepth,
  };
  post({ type: 'analysis', id: job.id, analysis });

  running = null;
  pvByIndex = new Map();
  seenDepth = 0;
  drain();
}

function finishCancelled(job: Job): void {
  if (!job.cancellationNotified) post({ type: 'cancelled', id: job.id });
  running = null;
  pvByIndex = new Map();
  seenDepth = 0;
  drain();
}

function cancelJob(id: string): void {
  const queuedIndex = queue.findIndex((job) => job.id === id);
  if (queuedIndex >= 0) {
    const [job] = queue.splice(queuedIndex, 1);
    if (job) post({ type: 'cancelled', id: job.id });
    return;
  }
  if (running?.id === id && !running.cancelled) {
    running.cancelled = true;
    running.cancellationNotified = true;
    post({ type: 'cancelled', id: running.id });
    engine?.postMessage('stop');
  }
}

function cancelAll(): void {
  for (const job of queue.splice(0)) post({ type: 'cancelled', id: job.id });
  if (running && !running.cancelled) {
    running.cancelled = true;
    running.cancellationNotified = true;
    post({ type: 'cancelled', id: running.id });
    engine?.postMessage('stop');
  }
}

function drain(): void {
  if (running || queue.length === 0 || !engine) return;
  const job = queue.shift()!;
  running = job;
  pvByIndex = new Map();
  seenDepth = 0;
  if (job.kind === 'play') {
    applyStrength(job.elo ?? 1500);
    engine.postMessage(`position fen ${job.fen}`);
    engine.postMessage(`go movetime ${job.movetimeMs ?? 400}`);
    return;
  }
  // analyze — always reset to full strength; the worker is shared with the
  // Coach, and a prior 'play' job may have capped UCI_Elo / Skill Level.
  engine.postMessage('setoption name UCI_LimitStrength value false');
  engine.postMessage('setoption name Skill Level value 20');
  engine.postMessage(`setoption name MultiPV value ${job.multipv}`);
  engine.postMessage(`position fen ${job.fen}`);
  const movetime = job.movetimeMs ? ` movetime ${job.movetimeMs}` : '';
  const restricted = job.searchMovesSan ?? [];
  const uciRestricted = restricted.length > 0 ? sanToUciMoves(job.fen, restricted) : [];
  const searchMoves = uciRestricted.length > 0 ? ` searchmoves ${uciRestricted.join(' ')}` : '';
  engine.postMessage(`go depth ${job.depth}${movetime}${searchMoves}`);
}

/** Map a target Elo to Stockfish strength options. UCI_Elo's floor is ~1320;
 *  weaker tiers fall back to Skill Level (0–5) since UCI_Elo can't go lower. */
function applyStrength(elo: number): void {
  if (!engine) return;
  if (elo >= 1320) {
    engine.postMessage('setoption name Skill Level value 20');
    engine.postMessage('setoption name UCI_LimitStrength value true');
    engine.postMessage(`setoption name UCI_Elo value ${Math.min(elo, 3190)}`);
  } else {
    engine.postMessage('setoption name UCI_LimitStrength value false');
    const skill = elo <= 800 ? 0 : Math.round(((elo - 800) / (1320 - 800)) * 5);
    engine.postMessage(`setoption name Skill Level value ${skill}`);
  }
}

// --- inbound dispatch ------------------------------------------------------

ctx.addEventListener('message', (e: MessageEvent<InboundMsg>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    void initEngine();
    return;
  }
  if (msg.type === 'analyze') {
    queue.push({
      id: msg.id,
      kind: 'analyze',
      fen: msg.fen,
      depth: msg.opts.depth ?? 20,
      multipv: msg.opts.multipv ?? 3,
      movetimeMs: msg.opts.movetimeMs,
      searchMovesSan: msg.opts.searchMovesSan,
    });
    drain();
    return;
  }
  if (msg.type === 'play') {
    queue.push({
      id: msg.id,
      kind: 'play',
      fen: msg.fen,
      depth: 0,
      multipv: 1,
      movetimeMs: msg.movetimeMs,
      elo: msg.elo,
    });
    drain();
    return;
  }
  if (msg.type === 'cancel') {
    cancelJob(msg.id);
    return;
  }
  if (msg.type === 'stop') {
    cancelAll();
  }
});
