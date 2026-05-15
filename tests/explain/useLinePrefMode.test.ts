/**
 * useLinePrefMode — per-line drill/explain pref tests (R1).
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useLinePrefMode } from '../../src/hooks/useLinePrefMode';

beforeEach(() => {
  window.localStorage.clear();
});
afterEach(() => {
  window.localStorage.clear();
});

describe('useLinePrefMode', () => {
  it('defaults to drill when no localStorage entry exists', () => {
    const { result } = renderHook(() => useLinePrefMode('line-a'));
    expect(result.current[0]).toBe('drill');
  });

  it('round-trips through localStorage per line', () => {
    const { result, rerender } = renderHook(
      ({ id }: { id: string }) => useLinePrefMode(id),
      { initialProps: { id: 'line-a' } },
    );
    act(() => {
      result.current[1]('explain');
    });
    expect(result.current[0]).toBe('explain');

    // Switch to line-b — fresh default.
    rerender({ id: 'line-b' });
    expect(result.current[0]).toBe('drill');

    // Switch back to line-a — should restore explain from localStorage.
    rerender({ id: 'line-a' });
    expect(result.current[0]).toBe('explain');
  });

  it('handles null lineId without writing localStorage', () => {
    const { result } = renderHook(() => useLinePrefMode(null));
    expect(result.current[0]).toBe('drill');
    act(() => {
      result.current[1]('explain');
    });
    // No throw; no keys written.
    expect(window.localStorage.length).toBe(0);
  });
});
