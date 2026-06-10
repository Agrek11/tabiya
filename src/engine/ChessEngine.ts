/**
 * ChessEngine — the engine-layer interface (Phase 4a, Constitution Article 5).
 *
 * The Coach pipeline depends on THIS interface, never a concrete engine. 4a
 * ships `StockfishWasmEngine`; a future `LeelaEngine` drops in behind the same
 * surface and passes the same contract suite (tests/engine/ChessEngine.contract).
 *
 * Article 9 — SAN is the lingua franca. Every move string that crosses this
 * boundary is SAN ("Nf3", "exd5", "O-O", "e8=Q+"). UCI ("g1f3") lives only
 * inside `stockfish-worker.ts`; it never escapes the worker.
 *
 * Article 5 — `EngineAnalysis` is deliberately a *superset* shape: 4b's
 * FeatureExtractor consumes `fen` + `bestmove` + `pvs` unchanged, so adding the
 * symbolic layers later requires no change to this contract.
 */

/** Engine name discriminant. Extend the union when a new engine lands. */
export type EngineName = 'stockfish' | 'leela';

/** Per-call analysis options. All optional; presets supply the real values. */
export type EngineOpts = {
  /** Search depth in plies. */
  depth?: number;
  /** Number of principal variations to return (UCI `MultiPV`). */
  multipv?: number;
  /** Soft cap on think time in milliseconds. */
  movetimeMs?: number;
  /** Cancellation — aborting stops the in-flight search for this call. */
  signal?: AbortSignal;
};

/** One principal variation. `moves` is a SAN sequence from the analyzed FEN. */
export type EnginePv = {
  /** SAN moves, best line first. `moves[0]` is the candidate move. */
  moves: string[];
  /** Centipawn score from the side-to-move's perspective. Positive = better. */
  scoreCp: number;
  /** Present only for forced mates: +N = mate in N for side to move, -N = against. */
  mateIn?: number;
  /** Depth this PV was resolved to. */
  depth: number;
};

/** The full result of one `analyze` call. SAN at every move field. */
export type EngineAnalysis = {
  /** The position analyzed (echoed back for cache-key + traceability). */
  fen: string;
  /** Best move in SAN — equal to `pvs[0].moves[0]`. */
  bestmove: string;
  /** Principal variations, best first; length ≈ `opts.multipv`. */
  pvs: EnginePv[];
  /** Human-readable engine identity, e.g. "Stockfish 16". */
  engineName: string;
  /** Final search depth reached. */
  engineDepth: number;
};

/**
 * The engine contract. Concrete impls own a Worker and resolve `ready` once
 * the engine has completed its UCI handshake.
 */
export interface ChessEngine {
  /** Analyze a FEN; resolves with SAN PVs. Rejects only on hard engine failure. */
  analyze(fen: string, opts: EngineOpts): Promise<EngineAnalysis>;
  /** Stop the current search. Idempotent; safe to call when idle. */
  stop(): void;
  /** Resolves when the engine has finished its handshake and is ready. */
  ready: Promise<void>;
  /** Engine discriminant. */
  readonly name: EngineName;
}
