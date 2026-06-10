/**
 * LlamaCppWebGPULLMClient — Task 11.3. `available()` is gated on BOTH
 * `navigator.gpu` presence AND the webgpuLlm flag; `complete` is not
 * implemented in 4a.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LlamaCppWebGPULLMClient, NotImplementedError } from '../../src/coach/LlamaCppWebGPULLMClient';
import { setWebgpuLlmFlag } from '../../src/storage/featureFlags';

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('LlamaCppWebGPULLMClient', () => {
  it('available() false when the flag is off, even with a GPU', async () => {
    vi.stubGlobal('navigator', { gpu: {} });
    setWebgpuLlmFlag(false);
    expect(await new LlamaCppWebGPULLMClient().available()).toBe(false);
  });

  it('available() false when no GPU, even with the flag on', async () => {
    vi.stubGlobal('navigator', {});
    setWebgpuLlmFlag(true);
    expect(await new LlamaCppWebGPULLMClient().available()).toBe(false);
  });

  it('available() true only with GPU AND flag on', async () => {
    vi.stubGlobal('navigator', { gpu: {} });
    setWebgpuLlmFlag(true);
    expect(await new LlamaCppWebGPULLMClient().available()).toBe(true);
  });

  it('complete() throws NotImplementedError in 4a', async () => {
    await expect(
      new LlamaCppWebGPULLMClient().complete({ systemPrompt: 's', userPrompt: 'u' }),
    ).rejects.toBeInstanceOf(NotImplementedError);
  });
});
