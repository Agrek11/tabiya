/**
 * useExplainTts — Web Speech wrapper tests (R6).
 *
 * Mocks `window.speechSynthesis` + `SpeechSynthesisUtterance`. Covers:
 *   - no-op when global flag is off
 *   - no-op when per-line muted
 *   - cancel() before each speak()
 *   - no-op when paused
 *   - graceful degrade when speechSynthesis is undefined
 *   - toggleLineMute writes localStorage
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useExplainTts } from '../../src/hooks/useExplainTts';
import { setExplainTtsFlag } from '../../src/storage/featureFlags';

const speakSpy = vi.fn();
const cancelSpy = vi.fn();
const utteranceCtor = vi.fn();

function installFakeSpeech(): void {
  utteranceCtor.mockImplementation(function (this: { text: string }, text: string) {
    this.text = text;
  });
  vi.stubGlobal('SpeechSynthesisUtterance', utteranceCtor);
  vi.stubGlobal('speechSynthesis', {
    speak: speakSpy,
    cancel: cancelSpy,
  });
  // Also mirror on window for the available-detection branch.
  (window as unknown as { speechSynthesis: unknown }).speechSynthesis = {
    speak: speakSpy,
    cancel: cancelSpy,
  };
  (window as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = utteranceCtor;
}

function uninstallFakeSpeech(): void {
  delete (window as unknown as { speechSynthesis?: unknown }).speechSynthesis;
  delete (window as unknown as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
}

beforeEach(() => {
  window.localStorage.clear();
  speakSpy.mockReset();
  cancelSpy.mockReset();
  utteranceCtor.mockReset();
  installFakeSpeech();
});
afterEach(() => {
  vi.unstubAllGlobals();
  uninstallFakeSpeech();
});

describe('useExplainTts', () => {
  it('no-ops speak() when global flag is off', () => {
    setExplainTtsFlag(false);
    const { result } = renderHook(() =>
      useExplainTts({ lineId: 'line-a', paused: false }),
    );
    expect(result.current.enabled).toBe(false);
    act(() => result.current.speak('hi'));
    expect(speakSpy).not.toHaveBeenCalled();
  });

  it('speaks when global flag is on and line not muted', () => {
    setExplainTtsFlag(true);
    const { result } = renderHook(() =>
      useExplainTts({ lineId: 'line-a', paused: false }),
    );
    expect(result.current.enabled).toBe(true);
    act(() => result.current.speak('hello'));
    expect(speakSpy).toHaveBeenCalledTimes(1);
    expect(cancelSpy).toHaveBeenCalledTimes(1); // cancel before each speak
  });

  it('cancel() runs before every speak()', () => {
    setExplainTtsFlag(true);
    const { result } = renderHook(() =>
      useExplainTts({ lineId: 'line-a', paused: false }),
    );
    act(() => result.current.speak('one'));
    act(() => result.current.speak('two'));
    expect(cancelSpy).toHaveBeenCalledTimes(2);
    expect(speakSpy).toHaveBeenCalledTimes(2);
  });

  it('no-op when paused=true', () => {
    setExplainTtsFlag(true);
    const { result } = renderHook(() =>
      useExplainTts({ lineId: 'line-a', paused: true }),
    );
    act(() => result.current.speak('hi'));
    expect(speakSpy).not.toHaveBeenCalled();
  });

  it('no-op when empty text', () => {
    setExplainTtsFlag(true);
    const { result } = renderHook(() =>
      useExplainTts({ lineId: 'line-a', paused: false }),
    );
    act(() => result.current.speak(''));
    expect(speakSpy).not.toHaveBeenCalled();
  });

  it('toggleLineMute writes localStorage and suppresses subsequent speaks', () => {
    setExplainTtsFlag(true);
    const { result } = renderHook(() =>
      useExplainTts({ lineId: 'line-a', paused: false }),
    );
    expect(result.current.mutedForLine).toBe(false);
    act(() => result.current.toggleLineMute());
    expect(result.current.mutedForLine).toBe(true);
    expect(window.localStorage.getItem('tabiya:linePrefs:line-a:ttsMute')).toBe('true');
    act(() => result.current.speak('quiet'));
    expect(speakSpy).not.toHaveBeenCalled();
  });

  it('available=false when speechSynthesis is undefined (older browsers)', () => {
    uninstallFakeSpeech();
    const { result } = renderHook(() =>
      useExplainTts({ lineId: 'line-a', paused: false }),
    );
    expect(result.current.available).toBe(false);
    setExplainTtsFlag(true);
    act(() => result.current.speak('x'));
    expect(speakSpy).not.toHaveBeenCalled();
  });
});
