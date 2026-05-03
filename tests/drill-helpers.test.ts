/**
 * Unit tests for the pure helper exports of useDrill module:
 *   - statusText (one string per state.kind)
 *   - flashOverlayFor (returns {square, kind} on flash states, null otherwise)
 *   - playerColorFor (orientation derived from line presence)
 *
 * Sound effects, confetti, and timer wiring are NOT covered — those are tested
 * manually via the dev server.
 */

import { describe, it, expect } from 'vitest';
import {
  statusText,
  flashOverlayFor,
  playerColorFor,
  type DrillState,
} from '../src/drill/useDrill';

describe('statusText', () => {
  it('returns a non-empty string for each state.kind', () => {
    const cases: DrillState[] = [
      { kind: 'awaiting_player', lineIndex: 0 },
      { kind: 'flash_correct', lineIndex: 1, square: 'e5' },
      { kind: 'flash_wrong', lineIndex: 0, square: 'd5' },
      { kind: 'auto_playing', lineIndex: 0 },
      { kind: 'complete' },
    ];
    cases.forEach((s) => {
      const t = statusText(s);
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    });
  });

  it('mentions restart in the complete status (line auto-resets)', () => {
    expect(statusText({ kind: 'complete' })).toMatch(/restart/i);
  });
});

describe('flashOverlayFor', () => {
  it('returns null for non-flash states', () => {
    expect(flashOverlayFor({ kind: 'awaiting_player', lineIndex: 0 })).toBeNull();
    expect(flashOverlayFor({ kind: 'auto_playing', lineIndex: 0 })).toBeNull();
    expect(flashOverlayFor({ kind: 'complete' })).toBeNull();
  });

  it('flash_correct → { square, kind: "correct" }', () => {
    expect(flashOverlayFor({ kind: 'flash_correct', lineIndex: 1, square: 'e5' })).toEqual({
      square: 'e5',
      kind: 'correct',
    });
  });

  it('flash_wrong → { square, kind: "wrong" }', () => {
    expect(flashOverlayFor({ kind: 'flash_wrong', lineIndex: 0, square: 'd5' })).toEqual({
      square: 'd5',
      kind: 'wrong',
    });
  });
});

describe('playerColorFor', () => {
  it('returns "black" when the line has at least one move (player drills against system-opener)', () => {
    expect(playerColorFor(['e4', 'e5'])).toBe('black');
    expect(playerColorFor(['e4'])).toBe('black');
  });

  it('returns "white" for an empty line (degenerate / complete-on-init case)', () => {
    expect(playerColorFor([])).toBe('white');
  });
});
