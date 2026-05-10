/**
 * Pure-function tests for the SRS scheduler.
 *
 * No IndexedDB, no React, no globals. Every transition matrix path tested
 * with a fixed clock so timestamps are deterministic.
 */

import { describe, expect, it } from 'vitest';
import {
  aggregateMasteryByFamily,
  aggregateMasteryByOpening,
  isDue,
  masteryPercent,
  nextSrsState,
} from '../src/storage/srs/scheduler';
import { BOX_INTERVALS_DAYS, type DrillResult, type Family, type Line, type SrsBox, type SrsState } from '../src/storage/types';

const NOW = new Date('2026-05-09T12:00:00Z');

function result(overrides: Partial<DrillResult> = {}): DrillResult {
  return {
    wrong_attempts: 0,
    hint_uses: 0,
    duration_ms: 1000,
    completed_at: NOW.toISOString(),
    ...overrides,
  };
}

function state(box: SrsBox, overrides: Partial<SrsState> = {}): SrsState {
  return {
    line_id: 'ruy-lopez-main',
    box,
    last_reviewed: '2026-05-01T00:00:00Z',
    attempts: 5,
    wrong_attempts_total: 3,
    hint_uses_total: 2,
    ...overrides,
  };
}

describe('nextSrsState — first-ever drill (prev = null)', () => {
  it('flawless first attempt → Box 2', () => {
    const s = nextSrsState(null, result({ wrong_attempts: 0 }), NOW);
    expect(s.box).toBe(2);
    expect(s.attempts).toBe(1);
    expect(s.wrong_attempts_total).toBe(0);
    expect(s.last_reviewed).toBe(NOW.toISOString());
  });

  it.each([1, 2])('1-2 wrong on first attempt → Box 2 (slack)', (w) => {
    const s = nextSrsState(null, result({ wrong_attempts: w }), NOW);
    expect(s.box).toBe(2);
  });

  it.each([3, 4, 10])('≥3 wrong on first attempt → Box 1', (w) => {
    const s = nextSrsState(null, result({ wrong_attempts: w }), NOW);
    expect(s.box).toBe(1);
  });

  it('hint counter accumulates from drill result', () => {
    const s = nextSrsState(null, result({ hint_uses: 7 }), NOW);
    expect(s.hint_uses_total).toBe(7);
  });
});

describe('nextSrsState — promotion (0 wrong)', () => {
  it.each([
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 5], // cap at 5 — no Box 6
  ])('Box %i + 0 wrong → Box %i', (start, expected) => {
    const s = nextSrsState(state(start as SrsBox), result({ wrong_attempts: 0 }), NOW);
    expect(s.box).toBe(expected);
  });
});

describe('nextSrsState — stay (1 or 2 wrong)', () => {
  it.each([1, 2, 3, 4, 5])('Box %i + 1 wrong → Box %i (no change)', (start) => {
    const s = nextSrsState(state(start as SrsBox), result({ wrong_attempts: 1 }), NOW);
    expect(s.box).toBe(start);
  });
  it.each([1, 2, 3, 4, 5])('Box %i + 2 wrong → Box %i (no change)', (start) => {
    const s = nextSrsState(state(start as SrsBox), result({ wrong_attempts: 2 }), NOW);
    expect(s.box).toBe(start);
  });
  it('stay branch still updates last_reviewed', () => {
    const prev = state(3, { last_reviewed: '2025-01-01T00:00:00Z' });
    const s = nextSrsState(prev, result({ wrong_attempts: 1 }), NOW);
    expect(s.last_reviewed).toBe(NOW.toISOString());
  });
});

describe('nextSrsState — demote-one (≥3 wrong)', () => {
  it.each([
    [1, 1], // floor
    [2, 1],
    [3, 2],
    [4, 3],
    [5, 4],
  ])('Box %i + 3 wrong → Box %i', (start, expected) => {
    const s = nextSrsState(state(start as SrsBox), result({ wrong_attempts: 3 }), NOW);
    expect(s.box).toBe(expected);
  });
  it('Box 5 + 5 wrong → Box 4 (demote-one, never to Box 1)', () => {
    const s = nextSrsState(state(5), result({ wrong_attempts: 5 }), NOW);
    expect(s.box).toBe(4);
  });
});

describe('nextSrsState — hint-neutral', () => {
  it('99 hint uses + 0 wrong still promotes', () => {
    const s = nextSrsState(state(2), result({ wrong_attempts: 0, hint_uses: 99 }), NOW);
    expect(s.box).toBe(3);
  });
  it('hint count flows into hint_uses_total', () => {
    const s = nextSrsState(state(2, { hint_uses_total: 5 }), result({ hint_uses: 3 }), NOW);
    expect(s.hint_uses_total).toBe(8);
  });
});

describe('nextSrsState — counters', () => {
  it('attempts increments by 1', () => {
    const s = nextSrsState(state(3, { attempts: 7 }), result(), NOW);
    expect(s.attempts).toBe(8);
  });
  it('wrong_attempts_total accumulates', () => {
    const s = nextSrsState(
      state(3, { wrong_attempts_total: 4 }),
      result({ wrong_attempts: 2 }),
      NOW
    );
    expect(s.wrong_attempts_total).toBe(6);
  });
});

describe('nextSrsState — defensive clamp', () => {
  it('out-of-band prev.box (0) clamped to 1', () => {
    const s = nextSrsState(state(0 as SrsBox), result({ wrong_attempts: 0 }), NOW);
    expect(s.box).toBe(2); // 0 → clamp to 1, then promote → 2
  });
  it('out-of-band prev.box (99) clamped to 5', () => {
    const s = nextSrsState(state(99 as SrsBox), result({ wrong_attempts: 0 }), NOW);
    expect(s.box).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// isDue boundary
// ---------------------------------------------------------------------------

describe('isDue', () => {
  function s(box: SrsBox, lastReviewed: string): SrsState {
    return state(box, { last_reviewed: lastReviewed });
  }

  it('1ms before due → false', () => {
    const lr = new Date('2026-05-08T12:00:00Z'); // 1 day ago exactly
    const intervalMs = BOX_INTERVALS_DAYS[1] * 24 * 60 * 60 * 1000;
    const justBefore = new Date(lr.getTime() + intervalMs - 1);
    expect(isDue(s(1, lr.toISOString()), justBefore)).toBe(false);
  });

  it('exactly at due → true', () => {
    const lr = new Date('2026-05-08T12:00:00Z');
    const intervalMs = BOX_INTERVALS_DAYS[1] * 24 * 60 * 60 * 1000;
    const exact = new Date(lr.getTime() + intervalMs);
    expect(isDue(s(1, lr.toISOString()), exact)).toBe(true);
  });

  it('Box 5 (30d) due check', () => {
    const lr = new Date('2026-04-09T12:00:00Z'); // 30 days before NOW
    expect(isDue(s(5, lr.toISOString()), NOW)).toBe(true);
  });

  it('corrupt timestamp treated as due', () => {
    expect(isDue(s(3, 'not-a-date'), NOW)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// masteryPercent
// ---------------------------------------------------------------------------

describe('masteryPercent', () => {
  it('null → 0', () => expect(masteryPercent(null)).toBe(0));
  it.each([
    [1, 20],
    [2, 40],
    [3, 60],
    [4, 80],
    [5, 100],
  ])('Box %i → %i%%', (box, expected) => {
    expect(masteryPercent(state(box as SrsBox))).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// aggregateMasteryByOpening
// ---------------------------------------------------------------------------

describe('aggregateMasteryByOpening', () => {
  const lines: Line[] = [
    { id: 'a', opening_id: 'X', name: '', moves: [], depth: 1, end_fen: '', popularity: 0, tags: [], strategic_notes: [], key_squares: [] },
    { id: 'b', opening_id: 'X', name: '', moves: [], depth: 1, end_fen: '', popularity: 0, tags: [], strategic_notes: [], key_squares: [] },
    { id: 'c', opening_id: 'Y', name: '', moves: [], depth: 1, end_fen: '', popularity: 0, tags: [], strategic_notes: [], key_squares: [] },
  ];

  it('mixed drilled / undrilled — undrilled counts as 0', () => {
    const states = new Map<string, SrsState>();
    states.set('a', state(5, { line_id: 'a' })); // 100
    // 'b' undrilled → 0
    states.set('c', state(3, { line_id: 'c' })); // 60
    const out = aggregateMasteryByOpening(states, lines);
    expect(out.get('X')).toBe(50); // (100 + 0) / 2
    expect(out.get('Y')).toBe(60);
  });

  it('no states → all openings 0', () => {
    const out = aggregateMasteryByOpening(new Map(), lines);
    expect(out.get('X')).toBe(0);
    expect(out.get('Y')).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// aggregateMasteryByFamily
// ---------------------------------------------------------------------------

describe('aggregateMasteryByFamily', () => {
  const families: Family[] = [
    { id: 'F1', name: '', category: 'open', eco_range: '', opening_ids: ['X', 'Y'] },
    { id: 'F2', name: '', category: 'closed', eco_range: '', opening_ids: [] },
  ];

  it('mean over member openings', () => {
    const perOp = new Map<string, number>([
      ['X', 80],
      ['Y', 40],
    ]);
    const out = aggregateMasteryByFamily(perOp, families);
    expect(out.get('F1')).toBe(60);
  });

  it('empty family → 0', () => {
    const out = aggregateMasteryByFamily(new Map(), families);
    expect(out.get('F2')).toBe(0);
  });

  it('missing opening in perOp counts as 0', () => {
    const perOp = new Map<string, number>([['X', 100]]);
    const out = aggregateMasteryByFamily(perOp, families);
    expect(out.get('F1')).toBe(50); // (100 + 0) / 2
  });
});
