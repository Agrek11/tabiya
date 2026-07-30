/**
 * useExplainMode — Phase 1b autoplay state machine for Explain Mode.
 *
 * Walks a `Line` ply-by-ply. For each ply it shows overlays (arrows + key
 * squares) and rationale text for `pauseMs` (default 1200 ms), then plays
 * the move on a chess.js instance, pauses briefly, and advances to the next
 * ply. Both colors are auto-played — Explain is narration, not drill.
 *
 * State machine (R3 + design §4):
 *
 *   idle ──ENTER──► showOverlays(i)
 *
 *   showOverlays(i) ──PAUSE_MS_ELAPSED──► playingMove(i)
 *   showOverlays(i) ──NEXT──► playingMove(i)        (manual advance)
 *   showOverlays(i) ──PAUSE──► (paused flag; timer freezes)
 *
 *   playingMove(i) ──MOVE_PLAYED──► awaiting_next(i)
 *
 *   awaiting_next(i) ──AUTO_ADVANCE──►
 *       showOverlays(i+1)            if i+1 < blocks.length
 *       complete                     otherwise
 *
 *   anywhere ──PREV──► showOverlays(i-1)   (chess.undo)
 *   anywhere ──RESTART──► showOverlays(0)  (chess.reset)
 *   anywhere ──SKIP──► complete            (skipped=true)
 *
 * The reducer is pure. Side effects (`setTimeout`, `chess.move`, `playMove()`,
 * `tts.cancel()`) live in `useEffect`s driven by state transitions.
 *
 * Constitution:
 *   - Article 7 (linear lines): one chess instance, no branching.
 *   - Article 14 (type discipline): strict, no `any`.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import { Chess } from 'chess.js';
import { playMove } from '../sound/sounds';
import type { ExplainBlock } from '../storage/types';

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

/** Default per-ply overlay dwell time. Per-block `pauseMs` overrides. */
export const DEFAULT_PAUSE_MS = 1200;

/** Post-move beat between playingMove → awaiting_next → next showOverlays. */
export const POST_MOVE_BEAT_MS = 150;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExplainState =
  | { kind: 'idle' }
  | {
      kind: 'showOverlays';
      lineIndex: number;
      /** Remaining timer ms when paused (null while running). */
      pausedRemainingMs: number | null;
    }
  | { kind: 'playingMove'; lineIndex: number }
  | { kind: 'awaiting_next'; lineIndex: number }
  | { kind: 'complete'; skipped: boolean };

export type ExplainAction =
  | { type: 'ENTER' }
  | { type: 'PAUSE_MS_ELAPSED' }
  | { type: 'MOVE_PLAYED' }
  | { type: 'AUTO_ADVANCE' }
  | { type: 'PAUSE'; remainingMs: number }
  | { type: 'RESUME' }
  | { type: 'NEXT' }
  | { type: 'PREV' }
  | { type: 'RESTART' }
  | { type: 'SKIP' };

export type UseExplainModeArgs = {
  /** SAN moves in playback order; must match `blocks` length when blocks present. */
  moves: readonly string[];
  /** Per-ply rationale + overlays. Pass empty `[]` to short-circuit to complete. */
  blocks: readonly ExplainBlock[];
  /** When true, the autoplay timer is paused. Re-running resumes the remainder. */
  paused: boolean;
};

export type UseExplainModeReturn = {
  state: ExplainState;
  /** Current FEN driven by the internal chess.js instance. */
  fen: string;
  /**
   * Block to render right now. `null` outside `showOverlays`. Overlays clear
   * for `playingMove`, `awaiting_next`, and `complete`.
   */
  currentBlock: ExplainBlock | null;
  /** Index into `blocks` for the current/active step (0 when idle). */
  currentPly: number;
  /** Last move played on the board, or null at line start. */
  lastMove: { from: string; to: string } | null;
  canPrev: boolean;
  canNext: boolean;
  next(): void;
  prev(): void;
  restart(): void;
  skip(): void;
};

// ---------------------------------------------------------------------------
// Reducer (pure)
// ---------------------------------------------------------------------------

function makeInitial(blocks: readonly ExplainBlock[]): ExplainState {
  if (blocks.length === 0) return { kind: 'complete', skipped: false };
  return { kind: 'showOverlays', lineIndex: 0, pausedRemainingMs: null };
}

export function reducer(
  state: ExplainState,
  action: ExplainAction,
  totalBlocks: number,
): ExplainState {
  switch (action.type) {
    case 'ENTER': {
      if (totalBlocks === 0) return { kind: 'complete', skipped: false };
      return { kind: 'showOverlays', lineIndex: 0, pausedRemainingMs: null };
    }
    case 'RESTART': {
      if (totalBlocks === 0) return { kind: 'complete', skipped: false };
      return { kind: 'showOverlays', lineIndex: 0, pausedRemainingMs: null };
    }
    case 'SKIP': {
      return { kind: 'complete', skipped: true };
    }
    case 'PAUSE': {
      if (state.kind !== 'showOverlays') return state;
      if (state.pausedRemainingMs !== null) return state; // already paused
      return { ...state, pausedRemainingMs: action.remainingMs };
    }
    case 'RESUME': {
      if (state.kind !== 'showOverlays') return state;
      return { ...state, pausedRemainingMs: null };
    }
    case 'PAUSE_MS_ELAPSED': {
      if (state.kind !== 'showOverlays') return state;
      return { kind: 'playingMove', lineIndex: state.lineIndex };
    }
    case 'NEXT': {
      // Force-advance from showOverlays (or paused). Skip directly to play.
      if (state.kind === 'showOverlays') {
        return { kind: 'playingMove', lineIndex: state.lineIndex };
      }
      return state;
    }
    case 'MOVE_PLAYED': {
      if (state.kind !== 'playingMove') return state;
      return { kind: 'awaiting_next', lineIndex: state.lineIndex };
    }
    case 'AUTO_ADVANCE': {
      if (state.kind !== 'awaiting_next') return state;
      const next = state.lineIndex + 1;
      if (next >= totalBlocks) {
        return { kind: 'complete', skipped: false };
      }
      return { kind: 'showOverlays', lineIndex: next, pausedRemainingMs: null };
    }
    case 'PREV': {
      // PREV is meaningful from any in-line state. If at index 0, no-op.
      // The caller is responsible for `chess.undo()` (side effect).
      const curIdx = 'lineIndex' in state ? state.lineIndex : 0;
      const prev = Math.max(0, curIdx - 1);
      if (state.kind === 'complete') {
        // Stepping back from complete jumps to the last ply's overlay.
        if (totalBlocks === 0) return state;
        return {
          kind: 'showOverlays',
          lineIndex: totalBlocks - 1,
          pausedRemainingMs: null,
        };
      }
      if (prev === curIdx) return state;
      return { kind: 'showOverlays', lineIndex: prev, pausedRemainingMs: null };
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useExplainMode({
  moves,
  blocks,
  paused,
}: UseExplainModeArgs): UseExplainModeReturn {
  // One chess.js instance per session — mirrors useDrill.
  const chess = useMemo(() => new Chess(), []);
  const totalBlocks = blocks.length;

  const [state, dispatch] = useReducer(
    (s: ExplainState, a: ExplainAction): ExplainState => reducer(s, a, totalBlocks),
    blocks,
    makeInitial,
  );

  // Timer ref — single setTimeout id, cleared on every transition.
  const timerRef = useRef<number | null>(null);
  // Timestamp the current `showOverlays` cycle started. Used to compute
  // remaining ms when PAUSE fires.
  const overlayStartedAtRef = useRef<number | null>(null);
  // Resume-remaining ms (when re-entering showOverlays after RESUME).
  const resumeMsRef = useRef<number | null>(null);
  // Stable handle on the latest `blocks` and `moves` for use inside effects
  // WITHOUT putting the array literals in dep lists — parent components
  // routinely pass new array references on each render. Effect dependence
  // keys on `state` (which carries lineIndex); the ref reads the current
  // block for that index.
  const blocksRef = useRef<readonly ExplainBlock[]>(blocks);
  const movesRef = useRef<readonly string[]>(moves);
  // Keep the refs current WITHOUT writing them during render (react-hooks/refs).
  // This effect is declared before the consuming effects below, so it runs
  // first on each commit and the latest arrays are in place when they read.
  useEffect(() => {
    blocksRef.current = blocks;
    movesRef.current = moves;
  });

  const clearTimer = useCallback((): void => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const setT = useCallback(
    (ms: number, action: ExplainAction): void => {
      clearTimer();
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        dispatch(action);
      }, ms);
    },
    [clearTimer],
  );

  // NOTE: No "reset on moves/blocks change" effect. The hook is designed to
  // be re-mounted by the parent via a React `key` keyed on `lineId` when the
  // line changes. Putting `moves` or `blocks` in a useEffect dep would loop
  // infinitely whenever the parent passes array literals (a real-world bug
  // observed in tests). See ExplainView mount key in DrillPage.tsx.

  // --- showOverlays — schedule the move-play timer --------------------------
  useEffect(() => {
    if (state.kind !== 'showOverlays') return;
    if (paused) return;
    const block = blocksRef.current[state.lineIndex];
    if (!block) return;
    const fullPause = block.pauseMs ?? DEFAULT_PAUSE_MS;
    const remainder = resumeMsRef.current ?? fullPause;
    resumeMsRef.current = null;
    overlayStartedAtRef.current = Date.now();
    setT(remainder, { type: 'PAUSE_MS_ELAPSED' });
    return () => clearTimer();
  }, [state, paused, setT, clearTimer]);

  // --- Handle paused flag flips during showOverlays -------------------------
  // When `paused` toggles true while in showOverlays, freeze remaining ms.
  // When it toggles false, the showOverlays effect above will pick up
  // `resumeMsRef` and re-schedule.
  const prevPausedRef = useRef<boolean>(paused);
  useEffect(() => {
    const wasPaused = prevPausedRef.current;
    prevPausedRef.current = paused;
    if (!wasPaused && paused) {
      if (state.kind === 'showOverlays' && overlayStartedAtRef.current !== null) {
        const elapsed = Date.now() - overlayStartedAtRef.current;
        const block = blocksRef.current[state.lineIndex];
        const fullPause = block?.pauseMs ?? DEFAULT_PAUSE_MS;
        const remaining = Math.max(0, fullPause - elapsed);
        resumeMsRef.current = remaining;
        clearTimer();
      }
    }
  }, [paused, state, clearTimer]);

  // --- playingMove — apply chess.js move + dispatch MOVE_PLAYED -------------
  useEffect(() => {
    if (state.kind !== 'playingMove') return;
    const san = movesRef.current[state.lineIndex];
    if (san === undefined) {
      dispatch({ type: 'MOVE_PLAYED' });
      return;
    }
    if (chess.history().length === state.lineIndex) {
      try {
        chess.move(san);
        playMove();
      } catch {
        chess.reset();
        for (let i = 0; i <= state.lineIndex; i += 1) {
          const m = movesRef.current[i];
          if (m === undefined) break;
          chess.move(m);
        }
        playMove();
      }
    }
    const id = window.setTimeout(() => dispatch({ type: 'MOVE_PLAYED' }), 0);
    return () => window.clearTimeout(id);
  }, [state, chess]);

  // --- awaiting_next — short beat, then auto-advance ------------------------
  useEffect(() => {
    if (state.kind !== 'awaiting_next') return;
    setT(POST_MOVE_BEAT_MS, { type: 'AUTO_ADVANCE' });
    return () => clearTimer();
  }, [state, setT, clearTimer]);

  // --- Cleanup on unmount ---------------------------------------------------
  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  // -------------------------------------------------------------------------
  // Controls
  // -------------------------------------------------------------------------
  const next = useCallback((): void => {
    clearTimer();
    // From showOverlays, force-advance; from awaiting_next, auto-advance
    // immediately; from playingMove, the in-flight effect will land soon
    // enough — but we still dispatch to nudge.
    if (state.kind === 'showOverlays') {
      dispatch({ type: 'NEXT' });
    } else if (state.kind === 'awaiting_next') {
      dispatch({ type: 'AUTO_ADVANCE' });
    } else if (state.kind === 'playingMove') {
      // Will resolve via the playingMove effect.
    }
  }, [state, clearTimer]);

  const prev = useCallback((): void => {
    clearTimer();
    if (state.kind === 'idle') return;
    if (totalBlocks === 0) return;
    const curIdx = 'lineIndex' in state ? state.lineIndex : totalBlocks - 1;
    // Special: from complete, jump to last ply WITHOUT undoing chess (chess
    // already at end). Reducer handles this; here we mirror chess state.
    if (state.kind === 'complete') {
      // chess is at end-of-line; we want to show the last ply's overlays,
      // which means undoing the last move (so the board shows pre-last-ply
      // FEN). Actually — design says PREV from anywhere goes back one ply
      // and re-shows overlays. From complete, that's "undo last move, show
      // overlays for last ply".
      if (chess.history().length > 0) chess.undo();
      dispatch({ type: 'PREV' });
      return;
    }
    if (curIdx === 0) return;
    // From showOverlays(i): board is at i-1 plies played (FEN before ply i).
    //   We want to show overlays for i-1, meaning FEN should be at i-2 plies.
    // From playingMove(i) / awaiting_next(i): board has i plies played
    // (move i either applied or in-flight). For awaiting_next, the move is
    // applied. For playingMove, move applied via the effect. We want
    // overlays(i-1) → FEN at i-1 plies played. Undo once.
    if (state.kind === 'showOverlays') {
      if (chess.history().length > 0) chess.undo();
    } else if (state.kind === 'awaiting_next') {
      if (chess.history().length > 0) chess.undo();
    }
    dispatch({ type: 'PREV' });
  }, [state, chess, totalBlocks, clearTimer]);

  const restart = useCallback((): void => {
    clearTimer();
    overlayStartedAtRef.current = null;
    resumeMsRef.current = null;
    chess.reset();
    dispatch({ type: 'RESTART' });
  }, [chess, clearTimer]);

  const skip = useCallback((): void => {
    clearTimer();
    dispatch({ type: 'SKIP' });
  }, [clearTimer]);

  // -------------------------------------------------------------------------
  // Derived values
  // -------------------------------------------------------------------------
  const currentPly = 'lineIndex' in state ? state.lineIndex : 0;
  const currentBlock: ExplainBlock | null =
    state.kind === 'showOverlays' ? (blocks[state.lineIndex] ?? null) : null;

  const lastMove: { from: string; to: string } | null = (() => {
    const hist = chess.history({ verbose: true });
    if (hist.length === 0) return null;
    const last = hist[hist.length - 1]!;
    return { from: last.from, to: last.to };
  })();

  const canPrev =
    state.kind !== 'idle' &&
    (state.kind === 'complete' ? totalBlocks > 0 : currentPly > 0);
  const canNext =
    state.kind === 'showOverlays' || state.kind === 'awaiting_next';

  return {
    state,
    fen: chess.fen(),
    currentBlock,
    currentPly,
    lastMove,
    canPrev,
    canNext,
    next,
    prev,
    restart,
    skip,
  };
}
