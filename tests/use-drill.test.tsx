/**
 * Hook-level tests for useDrill — covers behaviors not reachable from the
 * pure reducer/helpers tests:
 *   - lastMove tracking (null → {from,to} after a move)
 *   - showHint one-shot (sets hintSquare when awaiting_player, no-op otherwise)
 *   - hint auto-clears on state change
 *   - stepForward / stepBack mutate chess.js + state correctly
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useDrill } from '../src/drill/useDrill';

beforeEach(() => {
  // Audio cannot play in jsdom
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() =>
    Promise.resolve()
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

// Stable references — passing a new array literal on every render would
// retrigger useDrill's [line, playerColor, chess] reset effect infinitely.
const RUY_LOPEZ: readonly string[] = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'];
const SHORT: readonly string[] = ['e4', 'e5'];

describe('useDrill — drillResult emission (Phase 1)', () => {
  it('drillResult is null while line is in progress', () => {
    const { result } = renderHook(() => useDrill(SHORT, 'white'));
    expect(result.current.drillResult).toBeNull();
  });

  it('drillResult emits with wrong_attempts=0 after flawless completion', async () => {
    const { waitFor } = await import('@testing-library/react');
    const { result } = renderHook(() => useDrill(SHORT, 'white'));
    act(() => {
      result.current.onPieceDrop({ sourceSquare: 'e2', targetSquare: 'e4' });
    });
    await waitFor(() => {
      expect(result.current.state.kind).toBe('complete');
    });
    expect(result.current.drillResult).not.toBeNull();
    expect(result.current.drillResult?.wrong_attempts).toBe(0);
    expect(result.current.drillResult?.hint_uses).toBe(0);
  });
});

describe('useDrill — lastMove', () => {
  it('is null at the start of the line', () => {
    const { result } = renderHook(() => useDrill(SHORT, 'white'));
    expect(result.current.lastMove).toBeNull();
  });

  it('reflects the most recent move after a successful drag-drop', () => {
    const { result } = renderHook(() => useDrill(SHORT, 'white'));
    act(() => {
      result.current.onPieceDrop({ sourceSquare: 'e2', targetSquare: 'e4' });
    });
    expect(result.current.lastMove).toEqual({ from: 'e2', to: 'e4' });
  });

  it('reflects step-forward play', () => {
    const { result } = renderHook(() => useDrill(SHORT, 'white'));
    act(() => {
      result.current.stepForward();
    });
    expect(result.current.lastMove).toEqual({ from: 'e2', to: 'e4' });
  });
});

describe('useDrill — showHint', () => {
  it('sets hintSquare to the from-square of the next expected move', () => {
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'white'));
    // initial state: awaiting_player at lineIndex 0, expected = e4 → from e2
    expect(result.current.hintSquare).toBeNull();
    act(() => {
      result.current.showHint();
    });
    expect(result.current.hintSquare).toBe('e2');
  });

  it('is a no-op when state is not awaiting_player', () => {
    // player=black starts in auto_playing(0) — not awaiting_player
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'black'));
    expect(result.current.state.kind).toBe('auto_playing');
    act(() => {
      result.current.showHint();
    });
    expect(result.current.hintSquare).toBeNull();
  });

  it('clears the hint when the drill state advances', () => {
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'white'));
    act(() => {
      result.current.showHint();
    });
    expect(result.current.hintSquare).toBe('e2');

    // Stepping forward triggers a state change → hint clears.
    act(() => {
      result.current.stepForward();
    });
    expect(result.current.hintSquare).toBeNull();
  });
});

describe('useDrill — stepForward / stepBack', () => {
  it('stepForward applies the next expected move and advances state', () => {
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'white'));
    act(() => {
      result.current.stepForward();
    });
    expect(result.current.fen.startsWith(
      'rnbqkbnr/pppppppp/8/8/4P3'
    )).toBe(true);
    expect(result.current.state.kind).toBe('awaiting_player');
  });

  it('stepBack undoes the most recent move', () => {
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'white'));
    act(() => {
      result.current.stepForward();
    });
    expect(result.current.canStepBack).toBe(true);

    act(() => {
      result.current.stepBack();
    });
    // Back to starting FEN
    expect(result.current.fen).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
  });

  it('canStepBack is false at the very start of the line', () => {
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'white'));
    expect(result.current.canStepBack).toBe(false);
  });
});

describe('useDrill — wrong move stays on board', () => {
  it('applies a legal-but-wrong move on chess.js and enters wrong_pending', () => {
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'white'));
    // e4 is expected; play d4 instead (legal, wrong)
    act(() => {
      result.current.onPieceDrop({ sourceSquare: 'd2', targetSquare: 'd4' });
    });
    expect(result.current.state.kind).toBe('wrong_pending');
    // The wrong move IS applied — d4 reflected in lastMove
    expect(result.current.lastMove).toEqual({ from: 'd2', to: 'd4' });
  });

  it('stepBack from wrong_pending reverts to awaiting_player at same lineIndex', () => {
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'white'));
    act(() => {
      result.current.onPieceDrop({ sourceSquare: 'd2', targetSquare: 'd4' });
    });
    expect(result.current.state.kind).toBe('wrong_pending');
    act(() => {
      result.current.stepBack();
    });
    expect(result.current.state).toEqual({ kind: 'awaiting_player', lineIndex: 0 });
    expect(result.current.lastMove).toBeNull();
  });
});

describe('useDrill — restart', () => {
  it('resets chess and state to initial', () => {
    const { result } = renderHook(() => useDrill(RUY_LOPEZ, 'white'));
    // Two separate act calls — result.current is a snapshot that only
    // updates between act blocks once state has flushed.
    act(() => {
      result.current.stepForward();
    });
    act(() => {
      result.current.stepForward();
    });
    expect(result.current.canRestart).toBe(true);

    act(() => {
      result.current.restart();
    });
    expect(result.current.fen).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    );
    expect(result.current.state).toEqual({ kind: 'awaiting_player', lineIndex: 0 });
  });
});
