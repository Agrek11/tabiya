/**
 * useMoveRailCollapsed hook tests.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMoveRailCollapsed } from '../src/drill/use-move-rail-collapsed';

const KEY = 'tabiya.moveRailCollapsed';

describe('useMoveRailCollapsed', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('defaults to false on empty localStorage', () => {
    const { result } = renderHook(() => useMoveRailCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it('reads "1" as true', () => {
    window.localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useMoveRailCollapsed());
    expect(result.current[0]).toBe(true);
  });

  it('reads "0" as false', () => {
    window.localStorage.setItem(KEY, '0');
    const { result } = renderHook(() => useMoveRailCollapsed());
    expect(result.current[0]).toBe(false);
  });

  it('setCollapsed(true) writes "1" to localStorage', () => {
    const { result } = renderHook(() => useMoveRailCollapsed());
    act(() => {
      result.current[1](true);
    });
    expect(window.localStorage.getItem(KEY)).toBe('1');
    expect(result.current[0]).toBe(true);
  });

  it('setCollapsed(false) writes "0" to localStorage', () => {
    window.localStorage.setItem(KEY, '1');
    const { result } = renderHook(() => useMoveRailCollapsed());
    act(() => {
      result.current[1](false);
    });
    expect(window.localStorage.getItem(KEY)).toBe('0');
    expect(result.current[0]).toBe(false);
  });

  it('toggles independently in separate hook instances', () => {
    const { result: a } = renderHook(() => useMoveRailCollapsed());
    const { result: b } = renderHook(() => useMoveRailCollapsed());
    act(() => {
      a.current[1](true);
    });
    // localStorage updated; b's state was set at mount, so it remains stale
    // until next mount. Only verifies the writer side, not cross-instance sync.
    expect(window.localStorage.getItem(KEY)).toBe('1');
    expect(a.current[0]).toBe(true);
    expect(b.current[0]).toBe(false);
  });
});
