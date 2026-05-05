/**
 * useDrill — custom hook driving the drill state machine + line navigation.
 *
 * Owns:
 *   - the canonical Chess instance (source of truth for the position)
 *   - drill progression (lineIndex into the SAN array)
 *   - feedback state (correct flash + persistent wrong overlay)
 *   - timer wiring (flash decay, auto-play delay, completion-reset)
 *   - sound effect dispatch
 *   - back/forward/restart navigation through the line
 *
 * Behavior change vs Phase 0a:
 *   - Wrong moves NOW APPLY to chess.js (the piece stays on the destination
 *     square so the user sees what they played) and trigger a persistent
 *     `wrong_pending` state with a red cross overlay. The user must click
 *     Back to undo and retry. No automatic snap-back.
 *
 * Exposes to the view:
 *   - position (FEN string for react-chessboard)
 *   - flashOverlay (for tick/cross overlay via squareRenderer)
 *   - statusText, playerColor
 *   - onPieceDrop (drag-drop callback)
 *   - canStepBack, canStepForward, canRestart (button enablement)
 *   - stepBack, stepForward, restart (button handlers)
 */

import { useEffect, useReducer, useMemo, useState, useCallback } from 'react';
import { Chess } from 'chess.js';
import { compareMove, type MoveAttempt } from './move-comparator';
import { SAMPLE_LINE_SAN } from './sample-line';
import { playMove } from '../sound/sounds';

// ---------------------------------------------------------------------------
// State machine
// ---------------------------------------------------------------------------

export type DrillState =
  | { kind: 'awaiting_player'; lineIndex: number }
  | { kind: 'flash_correct'; lineIndex: number; square: string }
  | { kind: 'wrong_pending'; lineIndex: number; square: string }
  | { kind: 'auto_playing'; lineIndex: number }
  | { kind: 'complete' };

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type DrillAction =
  | {
      type: 'PLAYER_MOVE_ATTEMPTED';
      attempt: MoveAttempt;
      result: 'correct' | 'wrong' | 'illegal';
      destSquare: string;
    }
  | { type: 'FLASH_TIMER_DONE' }
  | { type: 'AUTO_PLAY_TIMER_DONE' }
  | { type: 'RESET' }
  | { type: 'STEP_BACK_DONE'; newLineIndex: number; chessHistoryLen: number }
  | { type: 'STEP_FORWARD_DONE'; newLineIndex: number };

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const FLASH_MS = 500;
const AUTO_PLAY_MS = 0; // static lines — no fake "thinking" pause
const HINT_TIER_RESET_MS = 5000; // 2nd-press tier window

// ---------------------------------------------------------------------------
// Initial-state factory + reducer
// ---------------------------------------------------------------------------

export function makeInitial(
  line: readonly string[],
  playerColor: 'white' | 'black' = 'black'
): DrillState {
  if (line.length === 0) return { kind: 'complete' };
  if (playerColor === 'white') {
    return { kind: 'awaiting_player', lineIndex: 0 };
  }
  return { kind: 'auto_playing', lineIndex: 0 };
}

export function createDrillReducer(
  line: readonly string[],
  playerColor: 'white' | 'black' = 'black'
) {
  return function drillReducer(state: DrillState, action: DrillAction): DrillState {
    if (action.type === 'RESET') {
      return makeInitial(line, playerColor);
    }

    if (action.type === 'STEP_BACK_DONE') {
      if (action.newLineIndex >= line.length) {
        return { kind: 'complete' };
      }
      return { kind: 'awaiting_player', lineIndex: action.newLineIndex };
    }

    if (action.type === 'STEP_FORWARD_DONE') {
      if (action.newLineIndex >= line.length) {
        return { kind: 'complete' };
      }
      return { kind: 'awaiting_player', lineIndex: action.newLineIndex };
    }

    if (state.kind === 'awaiting_player' && action.type === 'PLAYER_MOVE_ATTEMPTED') {
      if (action.result === 'correct') {
        return {
          kind: 'flash_correct',
          lineIndex: state.lineIndex + 1,
          square: action.destSquare,
        };
      }
      if (action.result === 'wrong') {
        return {
          kind: 'wrong_pending',
          lineIndex: state.lineIndex,
          square: action.destSquare,
        };
      }
      return state; // illegal — ignore
    }

    if (state.kind === 'flash_correct' && action.type === 'FLASH_TIMER_DONE') {
      if (state.lineIndex >= line.length) {
        return { kind: 'complete' };
      }
      return { kind: 'auto_playing', lineIndex: state.lineIndex };
    }

    if (state.kind === 'auto_playing' && action.type === 'AUTO_PLAY_TIMER_DONE') {
      const next = state.lineIndex + 1;
      if (next >= line.length) {
        return { kind: 'complete' };
      }
      return { kind: 'awaiting_player', lineIndex: next };
    }

    return state;
  };
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function statusText(state: DrillState): string {
  switch (state.kind) {
    case 'awaiting_player':
      return 'Your move';
    case 'flash_correct':
      return 'Correct';
    case 'wrong_pending':
      return 'Wrong move — click Back to retry';
    case 'auto_playing':
      return 'Opponent thinking…';
    case 'complete':
      return 'Line complete — press Restart to retry';
  }
}

export function flashOverlayFor(
  state: DrillState
): { square: string; kind: 'correct' | 'wrong' } | null {
  if (state.kind === 'flash_correct') return { square: state.square, kind: 'correct' };
  if (state.kind === 'wrong_pending') return { square: state.square, kind: 'wrong' };
  return null;
}

/** @deprecated — pass playerColor to useDrill directly. */
export function playerColorFor(line: readonly string[]): 'white' | 'black' {
  return line.length > 0 ? 'black' : 'white';
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseDrillReturn = {
  state: DrillState;
  fen: string;
  flashOverlay: { square: string; kind: 'correct' | 'wrong' } | null;
  statusText: string;
  playerColor: 'white' | 'black';
  onPieceDrop: (args: { sourceSquare: string; targetSquare: string }) => boolean;
  /** {from, to} of the last move played on the board; null at line start. */
  lastMove: { from: string; to: string } | null;
  /** From-square the most recent showHint() request resolved to. Auto-clears
   *  on next state change or after ~3s. Null when no hint is showing. */
  hintSquare: string | null;
  /** Tier 1 = pulse on piece (subtle). Tier 2 = full square highlight. Null
   *  when no hint is showing. Two consecutive showHint() calls within
   *  HINT_TIER_RESET_MS escalate from 1 → 2. */
  hintTier: 1 | 2 | null;
  /** One-shot: tier-1 hint on first call, tier-2 on second call within window. */
  showHint: () => void;
  canStepBack: boolean;
  canStepForward: boolean;
  canRestart: boolean;
  stepBack: () => void;
  stepForward: () => void;
  restart: () => void;
  /** Legal destination squares for a piece on `square`. Empty if it's not the
   *  player's turn to move that piece. Used by click-to-move UI to render
   *  green dots on legal squares after the user clicks one of their pieces. */
  legalMovesFrom: (square: string) => string[];
};

export function useDrill(
  line: readonly string[] = SAMPLE_LINE_SAN,
  playerColor: 'white' | 'black' = 'black'
): UseDrillReturn {
  const chess = useMemo(() => new Chess(), []);
  const reducer = useMemo(
    () => createDrillReducer(line, playerColor),
    [line, playerColor]
  );
  const [state, dispatch] = useReducer(reducer, undefined, () =>
    makeInitial(line, playerColor)
  );

  // Reset chess + state when the active line OR player color changes.
  useEffect(() => {
    chess.reset();
    dispatch({ type: 'RESET' });
  }, [line, playerColor, chess]);

  // Flash timer (only for flash_correct now — wrong_pending is persistent).
  useEffect(() => {
    if (state.kind !== 'flash_correct') return;
    const id = window.setTimeout(() => {
      dispatch({ type: 'FLASH_TIMER_DONE' });
    }, FLASH_MS);
    return () => window.clearTimeout(id);
  }, [state.kind]);

  // Auto-play timer + chess.js mutation. Mutation + sound deferred to the
  // timer callback so the board re-render (driven by the AUTO_PLAY_TIMER_DONE
  // dispatch) and the move sound land in the same tick — keeps opponent
  // moves audio/visual synced, matching the player-move path.
  useEffect(() => {
    if (state.kind !== 'auto_playing') return;
    const id = window.setTimeout(() => {
      if (chess.history().length === state.lineIndex) {
        const san = line[state.lineIndex];
        if (san !== undefined) {
          chess.move(san);
          playMove();
        }
      }
      dispatch({ type: 'AUTO_PLAY_TIMER_DONE' });
    }, AUTO_PLAY_MS);
    return () => window.clearTimeout(id);
  }, [state, chess, line]);

  // -------------------------------------------------------------------------
  // Drag-drop handler
  // -------------------------------------------------------------------------

  const onPieceDrop = ({
    sourceSquare,
    targetSquare,
  }: {
    sourceSquare: string;
    targetSquare: string;
  }): boolean => {
    if (state.kind !== 'awaiting_player') return false;

    const expectedSan = line[state.lineIndex];
    if (expectedSan === undefined) return false;

    const attempt: MoveAttempt = {
      from: sourceSquare,
      to: targetSquare,
      promotion: 'q',
    };

    const result = compareMove(chess, expectedSan, attempt);

    if (result.kind === 'correct') {
      chess.move(attempt);
      playMove();
      dispatch({
        type: 'PLAYER_MOVE_ATTEMPTED',
        attempt,
        result: 'correct',
        destSquare: targetSquare,
      });
      return true;
    }
    if (result.kind === 'wrong') {
      // NEW behavior: apply the wrong move on the board so the user can see it.
      // They must click Back to retry.
      chess.move(attempt);
      playMove();
      dispatch({
        type: 'PLAYER_MOVE_ATTEMPTED',
        attempt,
        result: 'wrong',
        destSquare: targetSquare,
      });
      return true; // accept the move visually
    }
    // illegal
    dispatch({
      type: 'PLAYER_MOVE_ATTEMPTED',
      attempt,
      result: 'illegal',
      destSquare: targetSquare,
    });
    return false;
  };

  // -------------------------------------------------------------------------
  // Navigation
  // -------------------------------------------------------------------------

  const navAllowed =
    state.kind === 'awaiting_player' ||
    state.kind === 'wrong_pending' ||
    state.kind === 'complete';
  const historyLen = chess.history().length;

  const canStepBack = navAllowed && historyLen > 0;
  const canStepForward =
    navAllowed &&
    state.kind !== 'wrong_pending' && // must back out wrong move first
    state.kind !== 'complete' &&
    state.kind === 'awaiting_player' &&
    state.lineIndex < line.length;
  const canRestart = navAllowed && historyLen > 0;

  const stepBack = useCallback((): void => {
    if (!canStepBack) return;
    chess.undo();
    let newLineIndex: number;
    if (state.kind === 'wrong_pending') {
      newLineIndex = state.lineIndex;
    } else if (state.kind === 'awaiting_player') {
      newLineIndex = Math.max(0, state.lineIndex - 1);
    } else {
      newLineIndex = Math.max(0, line.length - 1);
    }
    dispatch({
      type: 'STEP_BACK_DONE',
      newLineIndex,
      chessHistoryLen: chess.history().length,
    });
  }, [canStepBack, chess, state, line.length]);

  const stepForward = useCallback((): void => {
    if (!canStepForward) return;
    if (state.kind !== 'awaiting_player') return;
    const san = line[state.lineIndex];
    if (san === undefined) return;
    chess.move(san);
    playMove();
    dispatch({ type: 'STEP_FORWARD_DONE', newLineIndex: state.lineIndex + 1 });
  }, [canStepForward, chess, state, line]);

  const restart = useCallback((): void => {
    if (!canRestart) return;
    chess.reset();
    dispatch({ type: 'RESET' });
  }, [canRestart, chess]);

  // -------------------------------------------------------------------------
  // Hint (one-shot)
  // -------------------------------------------------------------------------

  const [hintSquare, setHintSquare] = useState<string | null>(null);
  const [hintTier, setHintTier] = useState<1 | 2 | null>(null);

  const showHint = useCallback((): void => {
    if (state.kind !== 'awaiting_player') return;
    const san = line[state.lineIndex];
    if (san === undefined) return;
    try {
      const m = chess.move(san);
      chess.undo();
      const fromSq = m?.from ?? null;
      setHintSquare(fromSq);
      // Tier escalation: if same square already shown, bump to 2; else start at 1.
      setHintTier((prev) => (prev === 1 && hintSquare === fromSq ? 2 : 1));
    } catch {
      setHintSquare(null);
      setHintTier(null);
    }
  }, [state, line, chess, hintSquare]);

  // Clear hint whenever drill state advances (move played, line changed, etc.).
  useEffect(() => {
    setHintSquare(null);
    setHintTier(null);
  }, [state]);

  // Auto-fade hint after window even if state hasn't changed.
  useEffect(() => {
    if (hintSquare === null) return;
    const id = window.setTimeout(() => {
      setHintSquare(null);
      setHintTier(null);
    }, HINT_TIER_RESET_MS);
    return () => window.clearTimeout(id);
  }, [hintSquare]);

  // -------------------------------------------------------------------------
  // Last-move highlight
  // -------------------------------------------------------------------------

  const lastMove: { from: string; to: string } | null = useMemo(() => {
    const hist = chess.history({ verbose: true });
    if (hist.length === 0) return null;
    const last = hist[hist.length - 1]!;
    return { from: last.from, to: last.to };
    // recompute on state change (chess.js is mutable)
  }, [state, chess]);

  const legalMovesFrom = useCallback(
    (square: string): string[] => {
      if (state.kind !== 'awaiting_player') return [];
      // chess.js verbose moves include `from`/`to`/`piece`/`color`. Filter to
      // pieces of the player's color so clicks on opponent pieces (or empty
      // squares passed in by mistake) yield no destinations.
      try {
        const moves = chess.moves({ square, verbose: true }) as Array<{
          from: string;
          to: string;
          color: 'w' | 'b';
        }>;
        const playerCode = playerColor === 'white' ? 'w' : 'b';
        return moves.filter((m) => m.color === playerCode).map((m) => m.to);
      } catch {
        return [];
      }
    },
    [state, chess, playerColor]
  );

  return {
    state,
    fen: chess.fen(),
    flashOverlay: flashOverlayFor(state),
    statusText: statusText(state),
    playerColor,
    onPieceDrop,
    lastMove,
    hintSquare,
    hintTier,
    showHint,
    canStepBack,
    canStepForward,
    canRestart,
    stepBack,
    stepForward,
    restart,
    legalMovesFrom,
  };
}
