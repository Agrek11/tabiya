/**
 * AnthropicLLMClient — direct `@anthropic-ai/sdk` client with prompt caching
 * (Task 5.2, Design §3). Article 3 — direct SDK, no orchestration framework.
 *
 * The system prompt carries `cache_control: { type: 'ephemeral' }` so repeated
 * Why-clicks (same template, different position) read the cached system block
 * instead of re-billing it — the cost discipline lever (R5.3). The cache hit
 * shows up as `usage.cacheRead` on the 2nd+ call.
 *
 * `dangerouslyAllowBrowser: true` — threat model documented in AISection.tsx:
 * single-user local app, the key already lives in this browser's localStorage,
 * no multi-tenant server to leak it from.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { LLMClient, LLMResponse, PromptPayload, ProviderName } from './LLMClient';

export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export class AnthropicLLMClient implements LLMClient {
  readonly providerName: ProviderName = 'cloud-anthropic';
  readonly modelName: string;
  private readonly apiKey: string;

  constructor(modelName: string, apiKey: string) {
    this.modelName = modelName;
    this.apiKey = apiKey;
  }

  async available(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  async complete(p: PromptPayload): Promise<LLMResponse> {
    // Dynamic import keeps the SDK out of the base trainer bundle (Article 11,
    // R9.7) — it loads as its own chunk on the first narration call.
    const { default: AnthropicSDK } = await import('@anthropic-ai/sdk');
    const client = new AnthropicSDK({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    const res = await client.messages.create({
      model: this.modelName,
      max_tokens: p.maxTokens ?? 400,
      temperature: p.temperature ?? 0.6,
      stop_sequences: p.stops,
      system: [{ type: 'text', text: p.systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: p.userPrompt }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      text,
      modelName: res.model,
      usage: {
        input: res.usage.input_tokens,
        output: res.usage.output_tokens,
        cacheRead: res.usage.cache_read_input_tokens ?? undefined,
      },
    };
  }
}
