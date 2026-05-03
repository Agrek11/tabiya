/**
 * useDrill — custom hook driving the Phase 0a drill state machine.
 *
 * Owns:
 *   - the canonical Chess instance (source of truth for the position)
 *   - drill progression (lineIndex into the SAN array)
 *   - feedback state (flash square + color)
 *   - timer wiring (flash decay, auto-play delay)
 *
 * Exposes to the view:
 *   - position (FEN string for react-chessboard)
 *   - squareStyles (customSquareStyles for flash)
 *   - statusText (human-readable status line)
 *   - onPieceDrop (callback for react-chessboard drag-drop)
 *
 * See specs/phase-0a-skeleton/design.md — state machine table + AD2, AD3, AD4, AD8.
 *
 * Constitution Article 9: SAN at module boundaries. Article 14: strict TS, no `any`.
 */

import { useEffect, useReducer, useMemo } from 'react';
import { Chess } from 'chess.js';
import type { CSSProperties } from 'react';
import { compareMove, type MoveAttempt } from './move-comparator';
import { SAMPLE_LINE_SAN } from './sample-line';

// ---------------------------------------------------------------------------
// State machine — discriminated union.
// `lineIndex` always points to the NEXT move to be played from the line.
// ---------------------------------------------------------------------------

export type DrillState =
  | { kind: 'awaiting_player'; lineIndex: number }
  | { kind: 'flash_correct'; lineIndex: number; square: string }
  | { kind: 'flash_wrong'; lineIndex: number; square: string }
  | { kind: 'auto_playing'; lineIndex: number }
  | { kind: 'complete' };

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type DrillAction =
  | {
      type: 'PLAYER_MOVE_ATTEMPTED';
      attempt: MoveAttempt;
      result: 'correct' | 'wrong' | 'illegal';
      destSquare: string;
    }
  | { type: 'FLASH_TIMER_DONE' }
  | { type: 'AUTO_PLAY_TIMER_DONE' };

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const FLASH_MS = 400;
const AUTO_PLAY_MS = 300;

// ---------------------------------------------------------------------------
// Reducer factory — closes over `line` so length checks have what they need.
// Exported for unit testing without a React render harness.
// ---------------------------------------------------------------------------

export function createDrillReducer(line: readonly string[]) {
  return function drillReducer(state: DrillState, action: DrillAction): DrillState {
    // Player just attempted a move while it was their turn.
    if (state.kind === 'awaiting_player' && action.type === 'PLAYER_MOVE_ATTEMPTED') {
      if (action.result === 'correct') {
        // Move was applied to chess.js by onPieceDrop; advance lineIndex.
        return {
          kind: 'flash_correct',
          lineIndex: state.lineIndex + 1,
          square: action.destSquare,
        };
      }
      if (action.result === 'wrong') {
        // Move NOT applied to chess.js (AD8); lineIndex unchanged.
        return {
          kind: 'flash_wrong',
          lineIndex: state.lineIndex,
          square: action.destSquare,
        };
      }
      // illegal → no-op
      return state;
    }

    // Player's correct flash decayed — either drill is done, or opponent plays next.
    if (state.kind === 'flash_correct' && action.type === 'FLASH_TIMER_DONE') {
      if (state.lineIndex >= line.length) {
        return { kind: 'complete' };
      }
      return { kind: 'auto_playing', lineIndex: state.lineIndex };
    }

    // Wrong-flash decayed — back to awaiting_player at same lineIndex.
    if (state.kind === 'flash_wrong' && action.type === 'FLASH_TIMER_DONE') {
      return { kind: 'awaiting_player', lineIndex: state.lineIndex };
    }

    // Opponent finished playing their move (chess.js was mutated by the effect).
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
// Helpers (pure)
// ---------------------------------------------------------------------------

export function statusText(state: DrillState): string {
  switch (state.kind) {
    case 'awaiting_player':
      return 'Your move';
    case 'flash_correct':
      return 'Correct';
    case 'flash_wrong':
      return 'Wrong — try again';
    case 'auto_playing':
      return 'Opponent…';
    case 'complete':
      return 'Line complete';
  }
}

export function squareStylesFor(state: DrillState): Record<string, CSSProperties> {
  if (state.kind === 'flash_correct') {
    return {
      [state.square]: {
        backgroundColor: 'rgba(0, 200, 0, 0.4)',
        transition: 'background-color 200ms ease-out',
      },
    };
  }
  if (state.kind === 'flash_wrong') {
    return {
      [state.square]: {
        backgroundColor: 'rgba(220, 40, 40, 0.45)',
        transition: 'background-color 200ms ease-out',
      },
    };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseDrillReturn = {
  state: DrillState;
  fen: string;
  squareStyles: Record<string, CSSProperties>;
  statusText: string;
  onPieceDrop: (args: { sourceSquare: string; targetSquare: string }) => boolean;
};

function initialStateFor(line: readonly string[]): DrillState {
  if (line.length === 0) return { kind: 'complete' };
  // First move always plays via the auto-play effect.
  // (Phase 0a assumption: opening lines start with White, system plays it.)
  return { kind: 'auto_playing', lineIndex: 0 };
}

export function useDrill(line: readonly string[] = SAMPLE_LINE_SAN): UseDrillReturn {
  // One Chess instance per mount. Never replaced, so timer callbacks always
  // see the current board state without needing refs.
  const chess = useMemo(() => new Chess(), []);

  // Re-create the reducer if `line` changes (tests + future multi-line UI).
  const reducer = useMemo(() => createDrillReducer(line), [line]);

  const [state, dispatch] = useReducer(reducer, line, initialStateFor);

  // -------------------------------------------------------------------------
  // Flash timer — when in a flash state, schedule decay; clean up on change.
  // Without clearTimeout cleanup, fast user moves would leak stale timers
  // that fire after the next state has already moved on, causing skipped
  // transitions or stuck flashes.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state.kind !== 'flash_correct' && state.kind !== 'flash_wrong') return;
    const id = window.setTimeout(() => {
      dispatch({ type: 'FLASH_TIMER_DONE' });
    }, FLASH_MS);
    return () => window.clearTimeout(id);
  }, [state.kind]);

  // -------------------------------------------------------------------------
  // Auto-play timer — when entering auto_playing, apply the next SAN to
  // chess.js, then schedule the timer that flips us to awaiting_player.
  //
  // StrictMode safety: chess.history().length increases by 1 each play;
  // it equals state.lineIndex iff this move hasn't been applied yet. Guards
  // against React 18 dev double-invocation of effects.
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (state.kind !== 'auto_playing') return;
    if (chess.history().length === state.lineIndex) {
      const san = line[state.lineIndex];
      if (san !== undefined) {
        chess.move(san);
      }
    }
    const id = window.setTimeout(() => {
      dispatch({ type: 'AUTO_PLAY_TIMER_DONE' });
    }, AUTO_PLAY_MS);
    return () => window.clearTimeout(id);
  }, [state, chess, line]);

  // -------------------------------------------------------------------------
  // Drag-drop handler from react-chessboard.
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
      promotion: 'q', // hardcode for skeleton; full handling in Phase 1
    };

    const result = compareMove(chess, expectedSan, attempt);

    if (result.kind === 'correct') {
      // compareMove always undoes — re-apply for real.
      chess.move(attempt);
      dispatch({
        type: 'PLAYER_MOVE_ATTEMPTED',
        attempt,
        result: 'correct',
        destSquare: targetSquare,
      });
      return true;
    }
    if (result.kind === 'wrong') {
      dispatch({
        type: 'PLAYER_MOVE_ATTEMPTED',
        attempt,
        result: 'wrong',
        destSquare: targetSquare,
      });
      return false;
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

  return {
    state,
    fen: chess.fen(),
    squareStyles: squareStylesFor(state),
    statusText: statusText(state),
    onPieceDrop,
  };
}
