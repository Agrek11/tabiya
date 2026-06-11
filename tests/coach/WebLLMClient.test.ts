/**
 * WebLLMClient — 4a.1 free tier (provider mocked). available() gates on
 * navigator.gpu + the webgpuLlm flag; complete() drives MLC web-llm's
 * OpenAI-shaped chat API; engine load is single-flight per model.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { create, createEngine } = vi.hoisted(() => {
  const create = vi.fn();
  return {
    create,
    createEngine: vi.fn(async () => ({ chat: { completions: { create } } })),
  };
});
vi.mock('@mlc-ai/web-llm', () => ({ CreateMLCEngine: createEngine }));

import {
  WebLLMClient,
  DEFAULT_WEBGPU_MODEL,
  _clearWebLLMEngineCacheForTesting,
} from '../../src/coach/WebLLMClient';
import { FLAG_STORAGE_KEYS } from '../../src/storage/featureFlags';

beforeEach(() => {
  localStorage.clear();
  _clearWebLLMEngineCacheForTesting();
  create.mockReset();
  createEngine.mockClear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('WebLLMClient.available', () => {
  it('false without navigator.gpu; true with gpu + flag on (default)', async () => {
    expect(await new WebLLMClient().available()).toBe(false); // jsdom: no gpu
    vi.stubGlobal('navigator', { ...navigator, gpu: {} });
    expect(await new WebLLMClient().available()).toBe(true); // flag defaults ON since 4a.1
  });

  it('kill switch: flag off → false even with gpu present', async () => {
    vi.stubGlobal('navigator', { ...navigator, gpu: {} });
    localStorage.setItem(FLAG_STORAGE_KEYS.webgpuLlm, 'false');
    expect(await new WebLLMClient().available()).toBe(false);
  });
});

describe('WebLLMClient.complete', () => {
  it('sends system+user messages and parses the first choice', async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: 'd3 keeps the bishop flexible.' } }],
      usage: { prompt_tokens: 900, completion_tokens: 25 },
    });

    const res = await new WebLLMClient().complete({ systemPrompt: 'SYS', userPrompt: 'USR' });

    expect(createEngine).toHaveBeenCalledWith(DEFAULT_WEBGPU_MODEL, expect.anything());
    const arg = create.mock.calls[0][0];
    expect(arg.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USR' },
    ]);
    expect(res.text).toBe('d3 keeps the bishop flexible.');
    expect(res.modelName).toBe(DEFAULT_WEBGPU_MODEL);
    expect(res.usage).toEqual({ input: 900, output: 25 });
  });

  it('engine load is single-flight — two completes share one CreateMLCEngine', async () => {
    create.mockResolvedValue({ choices: [{ message: { content: 'x' } }] });
    const client = new WebLLMClient();
    await Promise.all([
      client.complete({ systemPrompt: 's', userPrompt: 'a' }),
      client.complete({ systemPrompt: 's', userPrompt: 'b' }),
    ]);
    expect(createEngine).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('failed engine load is retryable (cache entry evicted)', async () => {
    createEngine.mockRejectedValueOnce(new Error('gpu OOM'));
    const client = new WebLLMClient();
    await expect(client.complete({ systemPrompt: 's', userPrompt: 'u' })).rejects.toThrow(
      'gpu OOM',
    );
    create.mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });
    const res = await client.complete({ systemPrompt: 's', userPrompt: 'u' });
    expect(res.text).toBe('ok');
    expect(createEngine).toHaveBeenCalledTimes(2);
  });
});
