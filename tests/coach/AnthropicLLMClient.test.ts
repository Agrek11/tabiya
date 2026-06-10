/**
 * AnthropicLLMClient — Task 11.3 (provider mocked).
 *
 * Asserts the system prompt is sent with `cache_control: { type: 'ephemeral' }`
 * (the cost-discipline lever, R5.3) and that text blocks are concatenated.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(function () {
    return { messages: { create } };
  }),
}));

import { AnthropicLLMClient } from '../../src/coach/AnthropicLLMClient';

afterEach(() => vi.clearAllMocks());

describe('AnthropicLLMClient', () => {
  it('available() reflects key presence', async () => {
    expect(await new AnthropicLLMClient('m', 'sk').available()).toBe(true);
    expect(await new AnthropicLLMClient('m', '').available()).toBe(false);
  });

  it('sends an ephemeral-cached system prompt and concatenates text blocks', async () => {
    create.mockResolvedValue({
      model: 'claude-haiku-4-5-20251001',
      content: [
        { type: 'text', text: 'd3 is ' },
        { type: 'text', text: 'the quiet main line.' },
      ],
      usage: { input_tokens: 1500, output_tokens: 40, cache_read_input_tokens: 1400 },
    });

    const client = new AnthropicLLMClient('claude-haiku-4-5-20251001', 'sk-ant-x');
    const res = await client.complete({ systemPrompt: 'SYS', userPrompt: 'USR' });

    const arg = create.mock.calls[0][0];
    expect(arg.system[0]).toMatchObject({
      type: 'text',
      text: 'SYS',
      cache_control: { type: 'ephemeral' },
    });
    expect(arg.messages).toEqual([{ role: 'user', content: 'USR' }]);
    expect(res.text).toBe('d3 is the quiet main line.');
    expect(res.usage).toEqual({ input: 1500, output: 40, cacheRead: 1400 });
  });
});
