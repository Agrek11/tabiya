/**
 * useExplainContent — sidecar lazy-loader tests (R2 + R5).
 *
 * Covers all branches of the state union: idle / loading / loaded / missing /
 * error, plus the cache-hit fast path and length-mismatch graceful-degrade.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import {
  _resetExplainContentCacheForTesting,
  useExplainContent,
} from '../../src/hooks/useExplainContent';

const SAMPLE = {
  line_id: 'sample',
  schema_version: 2,
  blocks: [
    { rationale: 'a' },
    { rationale: 'b' },
  ],
};

beforeEach(() => {
  _resetExplainContentCacheForTesting();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('useExplainContent', () => {
  it('returns idle when lineId is null', () => {
    const { result } = renderHook(() => useExplainContent({ lineId: null }));
    expect(result.current.kind).toBe('idle');
  });

  it('fetches and resolves to loaded on 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => SAMPLE,
      }),
    );
    const { result } = renderHook(() =>
      useExplainContent({ lineId: 'sample', expectedLength: 2 }),
    );
    await waitFor(() => expect(result.current.kind).toBe('loaded'), { timeout: 1500 });
    if (result.current.kind === 'loaded') {
      expect(result.current.data).toHaveLength(2);
    }
  });

  it('resolves to missing on 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      }),
    );
    const { result } = renderHook(() => useExplainContent({ lineId: 'absent' }));
    await waitFor(() => expect(result.current.kind).toBe('missing'), { timeout: 1500 });
  });

  it('resolves to error on network failure and does NOT cache', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValueOnce(new Error('network down')),
    );
    const { result } = renderHook(() => useExplainContent({ lineId: 'flaky' }));
    await waitFor(() => expect(result.current.kind).toBe('error'), { timeout: 1500 });

    // A second mount should re-attempt (cache miss because error wasn't stored).
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => SAMPLE,
      }),
    );
    const { result: r2 } = renderHook(() =>
      useExplainContent({ lineId: 'flaky', expectedLength: 2 }),
    );
    await waitFor(() => expect(r2.current.kind).toBe('loaded'), { timeout: 1500 });
  });

  it('treats length mismatch as missing (graceful degrade)', async () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => SAMPLE, // blocks length = 2
      }),
    );
    const { result } = renderHook(() =>
      useExplainContent({ lineId: 'sample', expectedLength: 19 }),
    );
    await waitFor(() => expect(result.current.kind).toBe('missing'), { timeout: 1500 });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('cache hit returns synchronously on remount', async () => {
    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => SAMPLE,
    });
    vi.stubGlobal('fetch', fetchSpy);
    const { result, unmount } = renderHook(() =>
      useExplainContent({ lineId: 'sample', expectedLength: 2 }),
    );
    await waitFor(() => expect(result.current.kind).toBe('loaded'), { timeout: 1500 });
    unmount();

    // Second mount — fetch should NOT be called again.
    const { result: r2 } = renderHook(() =>
      useExplainContent({ lineId: 'sample', expectedLength: 2 }),
    );
    expect(r2.current.kind).toBe('loaded');
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
