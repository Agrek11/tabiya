/**
 * useCoach — Task 11.5. Re-clicking the same position SHALL NOT re-invoke the
 * pipeline (single-flight cache); a preset OR model change SHALL invalidate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

const { runMock } = vi.hoisted(() => ({ runMock: vi.fn() }));
vi.mock('../../src/coach/CoachPipeline', async (orig) => {
  const actual = await orig<typeof import('../../src/coach/CoachPipeline')>();
  return { ...actual, CoachPipeline: { run: runMock } };
});

import { useCoach, _clearCoachCache } from '../../src/hooks/useCoach';
import { ENGINE_PRESET_CHANGED_EVENT } from '../../src/engine/presets';
import { AI_STORAGE_KEYS } from '../../src/coach/aiSettings';

const POS = { lineId: 'L1', plyIndex: 4, fen: 'fen-x', history: [] };

beforeEach(() => {
  localStorage.clear();
  _clearCoachCache();
  runMock.mockReset();
  runMock.mockResolvedValue({ engine: null, llm: undefined, promptVersion: 'v1' });
});
afterEach(() => localStorage.clear());

describe('useCoach cache', () => {
  it('dedupes repeat invocations for the same key', async () => {
    const { result } = renderHook(() => useCoach(POS));
    await act(async () => {
      result.current.invoke();
    });
    await act(async () => {
      result.current.invoke();
    });
    expect(runMock).toHaveBeenCalledTimes(1);
  });

  it('invalidates on engine-preset change', async () => {
    const { result } = renderHook(() => useCoach(POS));
    await act(async () => {
      result.current.invoke();
    });
    await act(async () => {
      window.dispatchEvent(new CustomEvent(ENGINE_PRESET_CHANGED_EVENT));
      result.current.invoke();
    });
    expect(runMock).toHaveBeenCalledTimes(2);
  });

  it('invalidates on a model storage change from another tab', async () => {
    const { result } = renderHook(() => useCoach(POS));
    await act(async () => {
      result.current.invoke();
    });
    await act(async () => {
      window.dispatchEvent(new StorageEvent('storage', { key: AI_STORAGE_KEYS.model }));
      result.current.invoke();
    });
    expect(runMock).toHaveBeenCalledTimes(2);
  });
});
