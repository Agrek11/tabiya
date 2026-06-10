/**
 * OpenAILLMClient — Task 11.3 (provider mocked). Asserts request shape +
 * response parsing.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('openai', () => ({
  default: vi.fn(function () {
    return { chat: { completions: { create } } };
  }),
}));

import { OpenAILLMClient } from '../../src/coach/OpenAILLMClient';

afterEach(() => vi.clearAllMocks());

describe('OpenAILLMClient', () => {
  it('available() reflects key presence', async () => {
    expect(await new OpenAILLMClient('gpt-4o-mini', 'sk').available()).toBe(true);
    expect(await new OpenAILLMClient('gpt-4o-mini', '').available()).toBe(false);
  });

  it('sends system+user messages and parses the first choice', async () => {
    create.mockResolvedValue({
      model: 'gpt-4o-mini',
      choices: [{ message: { content: 'Be2 is the calm sidestep.' } }],
      usage: { prompt_tokens: 1200, completion_tokens: 30 },
    });

    const res = await new OpenAILLMClient('gpt-4o-mini', 'sk-x').complete({
      systemPrompt: 'SYS',
      userPrompt: 'USR',
    });

    const arg = create.mock.calls[0][0];
    expect(arg.model).toBe('gpt-4o-mini');
    expect(arg.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'USR' },
    ]);
    expect(res.text).toBe('Be2 is the calm sidestep.');
    expect(res.usage).toEqual({ input: 1200, output: 30 });
  });
});
