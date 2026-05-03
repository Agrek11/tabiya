/**
 * useDrill — custom hook driving the Phase 0a drill state machine.
 *
 * Owns:
 *   - the canonical Chess instance (source of truth for the position)
 *   - drill progression (lineIndex into the SAN array)
 *   - feedback state (flash square + kind)
 *   - timer wiring (flash decay, auto-play delay, completion-reset)
 *   - sound effect dispatch on transitions
 *
 * Exposes to the view:
 *   - position (FEN string for react-chessboard)
 *   - flashSquare + flashKind (for corner-overlay tick/cross via squareRenderer)
 *   - statusText (human-readable status line)
 *   - playerColor ('white' | 'black') — for board orientation
 *   - onPieceDrop (callback for react-chessboard drag-drop)
 *
 * See specs/phase-0a-skeleton/design.md — state machine table + AD2, AD3, AD4, AD8.
 *
 * Constitution Article 9: SAN at module boundaries. Article 14: strict TS, no `any`.
 */

import { useEffect, useReducer, useMemo } from 'react';
import { Chess } from 'chess.js';
import { compareMove, type MoveAttempt } from './move-comparator';
import { SAMPLE_LINE_SAN } from './sample-line';
import { playMove } from '../sound/sounds';

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
  | { type: 'AUTO_PLAY_TIMER_DONE' }
  | { type: 'RESET' };

// ---------------------------------------------------------------------------
// Tunables
// ---------------------------------------------------------------------------

const FLASH_MS = 500;
const AUTO_PLAY_MS = 300;
const RESET_AFTER_COMPLETE_MS = 2200; // long enough for confetti to land

// ---------------------------------------------------------------------------
// Reducer factory — closes over `line` for length checks.
// Exported for unit testing without a React render harness.
// ---------------------------------------------------------------------------

function makeInitial(line: readonly string[]): DrillState {
  if (line.length === 0) return { kind: 'complete' };
  return { kind: 'auto_playing', lineIndex: 0 };
}

export function createDrillReducer(line: readonly string[]) {
  return function drillReducer(state: DrillState, action: DrillAction): DrillState {
    if (action.type === 'RESET') {
      return makeInitial(line);
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
          kind: 'flash_wrong',
          lineIndex: state.lineIndex,
          square: action.destSquare,
        };
      }
      return state;
    }

    if (state.kind === 'flash_correct' && action.type === 'FLASH_TIMER_DONE') {
      if (state.lineIndex >= line.length) {
        return { kind: 'complete' };
      }
      return { kind: 'auto_playing', lineIndex: state.lineIndex };
    }

    if (state.kind === 'flash_wrong' && action.type === 'FLASH_TIMER_DONE') {
      return { kind: 'awaiting_player', lineIndex: state.lineIndex };
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
      return 'Line complete — restarting…';
  }
}

/**
 * Returns the square (e.g. 'e5') and kind ('correct' | 'wrong') of the current
 * flash, or null if no flash is active. Consumed by `squareRenderer` to render
 * an overlay icon on top of the destination square's piece.
 */
export function flashOverlayFor(
  state: DrillState
): { square: string; kind: 'correct' | 'wrong' } | null {
  if (state.kind === 'flash_correct') return { square: state.square, kind: 'correct' };
  if (state.kind === 'flash_wrong') return { square: state.square, kind: 'wrong' };
  return null;
}

/**
 * Player color is derived from the line: assume the first move is White's
 * (system plays it), so the player drills as Black.
 */
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
};

export function useDrill(line: readonly string[] = SAMPLE_LINE_SAN): UseDrillReturn {
  const chess = useMemo(() => new Chess(), []);
  const reducer = useMemo(() => createDrillReducer(line), [line]);
  const [state, dispatch] = useReducer(reducer, line, makeInitial);

  // Flash timer.
  useEffect(() => {
    if (state.kind !== 'flash_correct' && state.kind !== 'flash_wrong') return;
    const id = window.setTimeout(() => {
      dispatch({ type: 'FLASH_TIMER_DONE' });
    }, FLASH_MS);
    return () => window.clearTimeout(id);
  }, [state.kind]);

  // Auto-play timer + chess.js mutation (StrictMode-safe via history-length guard).
  useEffect(() => {
    if (state.kind !== 'auto_playing') return;
    if (chess.history().length === state.lineIndex) {
      const san = line[state.lineIndex];
      if (san !== undefined) {
        chess.move(san);
        playMove();
      }
    }
    const id = window.setTimeout(() => {
      dispatch({ type: 'AUTO_PLAY_TIMER_DONE' });
    }, AUTO_PLAY_MS);
    return () => window.clearTimeout(id);
  }, [state, chess, line]);

  // Auto-reset on completion: revert chess.js to starting position and dispatch RESET
  // after the confetti settles, so the player can re-drill the line.
  useEffect(() => {
    if (state.kind !== 'complete') return;
    const id = window.setTimeout(() => {
      chess.reset();
      dispatch({ type: 'RESET' });
    }, RESET_AFTER_COMPLETE_MS);
    return () => window.clearTimeout(id);
  }, [state.kind, chess]);

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
      dispatch({
        type: 'PLAYER_MOVE_ATTEMPTED',
        attempt,
        result: 'wrong',
        destSquare: targetSquare,
      });
      return false;
    }
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
    flashOverlay: flashOverlayFor(state),
    statusText: statusText(state),
    playerColor: playerColorFor(line),
    onPieceDrop,
  };
}
