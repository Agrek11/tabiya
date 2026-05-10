/**
 * SRS scheduler — pure functions. No IndexedDB, no React, no globals.
 *
 * Drives all promotion / demotion math and mastery aggregation. Phase 1 spec
 * `specs/phase-1-srs-data-layer/`. Friction-tuned Leitner:
 *
 *   wrong_attempts == 0     → promote (cap Box 5)
 *   wrong_attempts ∈ {1,2}  → stay (touch last_reviewed)
 *   wrong_attempts ≥ 3      → demote one (floor Box 1)
 *
 * Hint use is counted but never affects box.
 */

import {
  BOX_INTERVALS_DAYS,
  type DrillResult,
  type Family,
  type Line,
  type SrsBox,
  type SrsState,
} from '../types';

const MIN_BOX: SrsBox = 1;
const MAX_BOX: SrsBox = 5;

function clampBox(n: number): SrsBox {
  if (n <= 1) return 1;
  if (n >= 5) return 5;
  return n as SrsBox;
}

function bumpBox(box: SrsBox, delta: number): SrsBox {
  return clampBox(box + delta);
}

/**
 * Compute next SrsState given previous state (or null for first-ever drill)
 * and the just-completed drill's result. Pure: clock injectable for tests.
 */
export function nextSrsState(
  prev: SrsState | null,
  result: DrillResult,
  now: Date = new Date()
): SrsState {
  const wrong = result.wrong_attempts;
  const last_reviewed = now.toISOString();

  if (prev === null) {
    // First-ever drill (Phase 1 spec R3.5):
    //   wrong ≥ 3 → Box 1 ; else Box 2 (a flawless first attempt promotes).
    const initialBox: SrsBox = wrong >= 3 ? 1 : 2;
    return {
      line_id: '',                       // caller fills line_id
      box: initialBox,
      last_reviewed,
      attempts: 1,
      wrong_attempts_total: wrong,
      hint_uses_total: result.hint_uses,
    };
  }

  // Defensive: clamp corrupt prev box value before computing transition.
  const prevBox = clampBox(prev.box);

  let nextBox: SrsBox;
  if (wrong === 0) {
    nextBox = bumpBox(prevBox, +1);    // promote (cap Box 5)
  } else if (wrong <= 2) {
    nextBox = prevBox;                 // stay (touch timestamp)
  } else {
    nextBox = bumpBox(prevBox, -1);    // demote one (floor Box 1)
  }

  return {
    line_id: prev.line_id,
    box: nextBox,
    last_reviewed,
    attempts: prev.attempts + 1,
    wrong_attempts_total: prev.wrong_attempts_total + wrong,
    hint_uses_total: prev.hint_uses_total + result.hint_uses,
  };
}

/**
 * Is this state due for review?
 *   now >= last_reviewed + BOX_INTERVALS_DAYS[box]
 */
export function isDue(state: SrsState, now: Date = new Date()): boolean {
  const box = clampBox(state.box);
  const intervalDays = BOX_INTERVALS_DAYS[box];
  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;
  const reviewedAt = Date.parse(state.last_reviewed);
  if (Number.isNaN(reviewedAt)) return true; // corrupt timestamp → treat as due
  return now.getTime() >= reviewedAt + intervalMs;
}

/**
 * Mastery percentage for one line, mapped from box value.
 * Box 1 = 20, 2 = 40, 3 = 60, 4 = 80, 5 = 100, null = 0.
 */
export function masteryPercent(state: SrsState | null): number {
  if (state === null) return 0;
  return clampBox(state.box) * 20;
}

/**
 * Aggregate per-line mastery into per-opening mastery.
 * Mean over all lines in the opening; lines without an SrsState count as 0
 * (Phase 1 spec R7.5 — "Drill to track" semantics).
 */
export function aggregateMasteryByOpening(
  states: Map<string, SrsState>,
  lines: readonly Line[]
): Map<string, number> {
  const byOpening = new Map<string, number[]>();
  for (const line of lines) {
    const list = byOpening.get(line.opening_id) ?? [];
    list.push(masteryPercent(states.get(line.id) ?? null));
    byOpening.set(line.opening_id, list);
  }
  const out = new Map<string, number>();
  for (const [openingId, percents] of byOpening) {
    if (percents.length === 0) {
      out.set(openingId, 0);
      continue;
    }
    const mean = percents.reduce((a, b) => a + b, 0) / percents.length;
    out.set(openingId, mean);
  }
  return out;
}

/**
 * Aggregate per-opening mastery into per-family mastery via simple mean.
 * Family with zero member openings → 0.
 */
export function aggregateMasteryByFamily(
  perOpening: Map<string, number>,
  families: readonly Family[]
): Map<string, number> {
  const out = new Map<string, number>();
  for (const family of families) {
    const ids = family.opening_ids;
    if (ids.length === 0) {
      out.set(family.id, 0);
      continue;
    }
    const values = ids.map((id) => perOpening.get(id) ?? 0);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    out.set(family.id, mean);
  }
  return out;
}

/** Internal exports for tests only. */
export const _internals = { MIN_BOX, MAX_BOX, clampBox, bumpBox };
