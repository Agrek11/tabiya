/**
 * OpenAILLMClient — direct `openai` SDK client (Task 5.3, Design §3).
 * Article 3 — direct SDK, no orchestration framework. No special caching
 * headers (OpenAI caches large prompts automatically server-side).
 */

import type { LLMClient, LLMResponse, PromptPayload, ProviderName } from './LLMClient';
import { parseStructuredResponse } from './parseStructuredResponse';

export const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

export class OpenAILLMClient implements LLMClient {
  readonly providerName: ProviderName = 'cloud-openai';
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
    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true });
    const res = await client.chat.completions.create({
      model: this.modelName,
      max_tokens: p.maxTokens ?? 400,
      temperature: p.temperature ?? 0.6,
      stop: p.stops,
      messages: [
        { role: 'system', content: p.systemPrompt },
        { role: 'user', content: p.userPrompt },
      ],
    });

    const text = res.choices[0]?.message.content ?? '';
    return {
      text,
      parsed: parseStructuredResponse(text) ?? undefined,
      modelName: res.model,
      usage: res.usage
        ? { input: res.usage.prompt_tokens, output: res.usage.completion_tokens }
        : undefined,
    };
  }
}
