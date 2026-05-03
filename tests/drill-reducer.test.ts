/**
 * Unit tests for the drill reducer (factory form).
 *
 * Tests are pure — no React render harness. We instantiate the reducer
 * with a stub line and exercise each (state, action) transition from
 * the design table in specs/phase-0a-skeleton/design.md.
 */

import { describe, it, expect } from 'vitest';
import { createDrillReducer, type DrillState, type DrillAction } from '../src/drill/useDrill';

const LINE = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'] as const; // length 5
const reducer = createDrillReducer(LINE);

const correctAction = (destSquare: string): DrillAction => ({
  type: 'PLAYER_MOVE_ATTEMPTED',
  attempt: { from: 'd7', to: destSquare },
  result: 'correct',
  destSquare,
});

const wrongAction = (destSquare: string): DrillAction => ({
  type: 'PLAYER_MOVE_ATTEMPTED',
  attempt: { from: 'd7', to: destSquare },
  result: 'wrong',
  destSquare,
});

const illegalAction = (destSquare: string): DrillAction => ({
  type: 'PLAYER_MOVE_ATTEMPTED',
  attempt: { from: 'd7', to: destSquare },
  result: 'illegal',
  destSquare,
});

describe('drillReducer — awaiting_player', () => {
  const init: DrillState = { kind: 'awaiting_player', lineIndex: 1 };

  it('correct → flash_correct, lineIndex incremented, square preserved', () => {
    const next = reducer(init, correctAction('e5'));
    expect(next).toEqual({ kind: 'flash_correct', lineIndex: 2, square: 'e5' });
  });

  it('wrong → wrong_pending, lineIndex unchanged (persistent until user navs)', () => {
    const next = reducer(init, wrongAction('d5'));
    expect(next).toEqual({ kind: 'wrong_pending', lineIndex: 1, square: 'd5' });
  });

  it('illegal → no-op', () => {
    const next = reducer(init, illegalAction('e5'));
    expect(next).toEqual(init);
  });
});

describe('drillReducer — flash_correct + FLASH_TIMER_DONE', () => {
  it('mid-line → auto_playing at same lineIndex', () => {
    const init: DrillState = { kind: 'flash_correct', lineIndex: 2, square: 'e5' };
    const next = reducer(init, { type: 'FLASH_TIMER_DONE' });
    expect(next).toEqual({ kind: 'auto_playing', lineIndex: 2 });
  });

  it('at end of line → complete', () => {
    const init: DrillState = { kind: 'flash_correct', lineIndex: 5, square: 'Bb5' };
    const next = reducer(init, { type: 'FLASH_TIMER_DONE' });
    expect(next).toEqual({ kind: 'complete' });
  });
});

describe('drillReducer — wrong_pending', () => {
  it('does NOT auto-clear on FLASH_TIMER_DONE (no timer should fire)', () => {
    const init: DrillState = { kind: 'wrong_pending', lineIndex: 1, square: 'd5' };
    const next = reducer(init, { type: 'FLASH_TIMER_DONE' });
    expect(next).toEqual(init);
  });

  it('clears on STEP_BACK_DONE → awaiting_player at same lineIndex', () => {
    const init: DrillState = { kind: 'wrong_pending', lineIndex: 1, square: 'd5' };
    const next = reducer(init, {
      type: 'STEP_BACK_DONE',
      newLineIndex: 1,
      chessHistoryLen: 1,
    });
    expect(next).toEqual({ kind: 'awaiting_player', lineIndex: 1 });
  });
});

describe('drillReducer — auto_playing + AUTO_PLAY_TIMER_DONE', () => {
  it('mid-line → awaiting_player at lineIndex+1', () => {
    const init: DrillState = { kind: 'auto_playing', lineIndex: 0 };
    const next = reducer(init, { type: 'AUTO_PLAY_TIMER_DONE' });
    expect(next).toEqual({ kind: 'awaiting_player', lineIndex: 1 });
  });

  it('penultimate move (lineIndex+1 = line.length) → complete', () => {
    const init: DrillState = { kind: 'auto_playing', lineIndex: 4 };
    const next = reducer(init, { type: 'AUTO_PLAY_TIMER_DONE' });
    expect(next).toEqual({ kind: 'complete' });
  });
});

describe('drillReducer — terminal + irrelevant transitions', () => {
  it('complete + any action → unchanged', () => {
    const init: DrillState = { kind: 'complete' };
    expect(reducer(init, { type: 'FLASH_TIMER_DONE' })).toEqual(init);
    expect(reducer(init, { type: 'AUTO_PLAY_TIMER_DONE' })).toEqual(init);
    expect(reducer(init, correctAction('e5'))).toEqual(init);
  });

  it('awaiting_player + FLASH_TIMER_DONE → unchanged', () => {
    const init: DrillState = { kind: 'awaiting_player', lineIndex: 2 };
    expect(reducer(init, { type: 'FLASH_TIMER_DONE' })).toEqual(init);
  });

  it('flash_correct + AUTO_PLAY_TIMER_DONE → unchanged', () => {
    const init: DrillState = { kind: 'flash_correct', lineIndex: 2, square: 'e5' };
    expect(reducer(init, { type: 'AUTO_PLAY_TIMER_DONE' })).toEqual(init);
  });

  it('wrong_pending + AUTO_PLAY_TIMER_DONE → unchanged', () => {
    const init: DrillState = { kind: 'wrong_pending', lineIndex: 1, square: 'd5' };
    expect(reducer(init, { type: 'AUTO_PLAY_TIMER_DONE' })).toEqual(init);
  });

  it('auto_playing + PLAYER_MOVE_ATTEMPTED → unchanged (player cannot move during opponent turn)', () => {
    const init: DrillState = { kind: 'auto_playing', lineIndex: 1 };
    expect(reducer(init, correctAction('e5'))).toEqual(init);
  });
});

describe('drillReducer — RESET action', () => {
  it('from complete + RESET → auto_playing(0) for a non-empty line (default black)', () => {
    const next = reducer({ kind: 'complete' }, { type: 'RESET' });
    expect(next).toEqual({ kind: 'auto_playing', lineIndex: 0 });
  });

  it('from any state + RESET → initial state', () => {
    const states: DrillState[] = [
      { kind: 'awaiting_player', lineIndex: 3 },
      { kind: 'flash_correct', lineIndex: 2, square: 'e5' },
      { kind: 'flash_wrong', lineIndex: 1, square: 'd5' },
      { kind: 'auto_playing', lineIndex: 4 },
      { kind: 'complete' },
    ];
    states.forEach((s) => {
      expect(reducer(s, { type: 'RESET' })).toEqual({ kind: 'auto_playing', lineIndex: 0 });
    });
  });

  it('empty line + RESET → complete', () => {
    const r = createDrillReducer([]);
    expect(r({ kind: 'auto_playing', lineIndex: 0 }, { type: 'RESET' })).toEqual({
      kind: 'complete',
    });
  });

  it('player=white + RESET → awaiting_player(0) (player makes the first move)', () => {
    const r = createDrillReducer(LINE, 'white');
    expect(r({ kind: 'complete' }, { type: 'RESET' })).toEqual({
      kind: 'awaiting_player',
      lineIndex: 0,
    });
  });

  it('player=black + RESET → auto_playing(0) (system makes the first move)', () => {
    const r = createDrillReducer(LINE, 'black');
    expect(r({ kind: 'complete' }, { type: 'RESET' })).toEqual({
      kind: 'auto_playing',
      lineIndex: 0,
    });
  });
});

describe('drillReducer — empty line edge', () => {
  it('reducer with empty line still handles all actions safely', () => {
    const r = createDrillReducer([]);
    const init: DrillState = { kind: 'awaiting_player', lineIndex: 0 };
    // 0 >= 0, so flash_correct + timer would go to complete
    const flashState: DrillState = { kind: 'flash_correct', lineIndex: 0, square: 'e4' };
    expect(r(flashState, { type: 'FLASH_TIMER_DONE' })).toEqual({ kind: 'complete' });
    // illegal action stays put
    expect(r(init, illegalAction('e5'))).toEqual(init);
  });
});
