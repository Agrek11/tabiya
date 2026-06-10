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

// --- message protocol (mirrored in StockfishWasmEngine) --------------------

type InitMsg = { type: 'init' };
type AnalyzeMsg = {
  type: 'analyze';
  id: string;
  fen: string;
  opts: { depth?: number; multipv?: number; movetimeMs?: number };
};
type StopMsg = { type: 'stop' };
type InboundMsg = InitMsg | AnalyzeMsg | StopMsg;

type ReadyMsg = { type: 'ready' };
type AnalysisMsg = { type: 'analysis'; id: string; analysis: EngineAnalysis };
type ErrorMsg = { type: 'error'; id?: string; message: string };
type OutboundMsg = ReadyMsg | AnalysisMsg | ErrorMsg;

const ctx = self as unknown as Worker;
function post(msg: OutboundMsg): void {
  ctx.postMessage(msg);
}

// --- engine lifecycle ------------------------------------------------------

let engine: StockfishInstance | null = null;
let engineName = 'Stockfish';

type Job = {
  id: string;
  fen: string;
  depth: number;
  multipv: number;
  movetimeMs?: number;
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
    finishJob();
    return;
  }
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

function finishJob(): void {
  const job = running;
  if (!job) return;

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

function drain(): void {
  if (running || queue.length === 0 || !engine) return;
  const job = queue.shift()!;
  running = job;
  pvByIndex = new Map();
  seenDepth = 0;
  engine.postMessage(`setoption name MultiPV value ${job.multipv}`);
  engine.postMessage(`position fen ${job.fen}`);
  const movetime = job.movetimeMs ? ` movetime ${job.movetimeMs}` : '';
  engine.postMessage(`go depth ${job.depth}${movetime}`);
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
      fen: msg.fen,
      depth: msg.opts.depth ?? 20,
      multipv: msg.opts.multipv ?? 3,
      movetimeMs: msg.opts.movetimeMs,
    });
    drain();
    return;
  }
  if (msg.type === 'stop') {
    queue.length = 0;
    engine?.postMessage('stop');
    return;
  }
});
