/**
 * OllamaLLMClient — Task 11.3. No msw in the repo, so `fetch` is stubbed
 * directly. Covers available() true/false and the chat happy path.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { OllamaLLMClient } from '../../src/coach/OllamaLLMClient';

afterEach(() => vi.unstubAllGlobals());

describe('OllamaLLMClient', () => {
  it('available() true when /api/tags responds ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    expect(await new OllamaLLMClient('llama3.2:3b-instruct').available()).toBe(true);
  });

  it('available() false when the daemon is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    expect(await new OllamaLLMClient('llama3.2:3b-instruct').available()).toBe(false);
  });

  it('POSTs system+user to /api/chat and parses message.content', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        message: { content: 'Qb6 hits the pawn chain base.' },
        prompt_eval_count: 800,
        eval_count: 25,
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await new OllamaLLMClient('llama3.2:3b-instruct').complete({
      systemPrompt: 'SYS',
      userPrompt: 'USR',
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/chat');
    const body = JSON.parse(init.body);
    expect(body.stream).toBe(false);
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USR' },
    ]);
    expect(res.text).toBe('Qb6 hits the pawn chain base.');
    expect(res.usage).toEqual({ input: 800, output: 25 });
  });
});
