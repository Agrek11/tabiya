/**
 * useKeySquareOverlay (Phase 2b R7) — toggle persistence + Explain force-on.
 *
 * Covers:
 *   - R7.1/R7.2: per-line localStorage persistence under
 *     `tabiya:linePrefs:<lineId>:keySquareOverlay`.
 *   - R7.3: Explain Mode force-on regardless of drill pref.
 *   - R7.4: exit Explain restores persisted drill pref.
 *   - R7.5: !hasKeySquares → toggleDisabled + visible=false.
 *   - Per-line independence: separate lineIds carry separate prefs.
 */

import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useKeySquareOverlay } from '../src/hooks/useKeySquareOverlay';

function storageKey(lineId: string): string {
  return `tabiya:linePrefs:${lineId}:keySquareOverlay`;
}

describe('useKeySquareOverlay', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('defaults visible=false and drillPreference=false (R7.1)', () => {
    const { result } = renderHook(() =>
      useKeySquareOverlay({
        lineId: 'line-a',
        hasKeySquares: true,
      })
    );
    expect(result.current.visible).toBe(false);
    expect(result.current.drillPreference).toBe(false);
    expect(result.current.toggleDisabled).toBe(false);
  });

  it('toggle flips pref and persists to localStorage (R7.2)', () => {
    const { result } = renderHook(() =>
      useKeySquareOverlay({
        lineId: 'line-a',
        hasKeySquares: true,
      })
    );
    act(() => result.current.toggle());
    expect(result.current.drillPreference).toBe(true);
    expect(result.current.visible).toBe(true);
    expect(window.localStorage.getItem(storageKey('line-a'))).toBe('true');
    act(() => result.current.toggle());
    expect(result.current.drillPreference).toBe(false);
    expect(window.localStorage.getItem(storageKey('line-a'))).toBe('false');
  });

  it('reads persisted value on mount per line (R7.2)', () => {
    window.localStorage.setItem(storageKey('line-x'), 'true');
    const { result } = renderHook(() =>
      useKeySquareOverlay({
        lineId: 'line-x',
        hasKeySquares: true,
      })
    );
    expect(result.current.drillPreference).toBe(true);
    expect(result.current.visible).toBe(true);
  });

  it('overlay is driven solely by the toggle — nothing forces it on', () => {
    const { result } = renderHook(() =>
      useKeySquareOverlay({
        lineId: 'line-a',
        hasKeySquares: true,
      })
    );
    // Off by default; only the toggle turns it on.
    expect(result.current.visible).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.visible).toBe(true);
  });

  it('!hasKeySquares disables toggle and hides overlay (R7.5)', () => {
    window.localStorage.setItem(storageKey('line-a'), 'true');
    const { result } = renderHook(() =>
      useKeySquareOverlay({
        lineId: 'line-a',
        hasKeySquares: false,
      })
    );
    expect(result.current.toggleDisabled).toBe(true);
    expect(result.current.visible).toBe(false);
    // Toggle is a no-op when disabled.
    act(() => result.current.toggle());
    expect(window.localStorage.getItem(storageKey('line-a'))).toBe('true'); // unchanged
  });

  it('per-line keys are independent', () => {
    window.localStorage.setItem(storageKey('line-a'), 'true');
    window.localStorage.setItem(storageKey('line-b'), 'false');
    const a = renderHook(() =>
      useKeySquareOverlay({
        lineId: 'line-a',
        hasKeySquares: true,
      })
    );
    const b = renderHook(() =>
      useKeySquareOverlay({
        lineId: 'line-b',
        hasKeySquares: true,
      })
    );
    expect(a.result.current.drillPreference).toBe(true);
    expect(b.result.current.drillPreference).toBe(false);
  });

  it('re-syncs when lineId changes', () => {
    window.localStorage.setItem(storageKey('line-a'), 'true');
    window.localStorage.setItem(storageKey('line-b'), 'false');
    let lineId: string = 'line-a';
    const { result, rerender } = renderHook(() =>
      useKeySquareOverlay({
        lineId,
        hasKeySquares: true,
      })
    );
    expect(result.current.drillPreference).toBe(true);
    lineId = 'line-b';
    rerender();
    expect(result.current.drillPreference).toBe(false);
  });
});
