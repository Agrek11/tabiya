/**
 * OllamaLLMClient — local inference via raw HTTP to the Ollama daemon
 * (Task 5.4, Design §3). No SDK, no API key — Article 11 (local-first),
 * Article 12 (backend optional). `available()` probes `/api/tags`; an
 * unreachable daemon returns false and the surface falls to degraded mode.
 */

import type { LLMClient, LLMResponse, PromptPayload, ProviderName } from './LLMClient';
import { parseStructuredResponse } from './parseStructuredResponse';

export const DEFAULT_OLLAMA_MODEL = 'llama3.2:3b-instruct';
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

type OllamaChatResponse = {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
};

export class OllamaLLMClient implements LLMClient {
  readonly providerName: ProviderName = 'local-ollama';
  readonly modelName: string;
  private readonly endpoint: string;

  constructor(modelName: string, endpoint: string = DEFAULT_OLLAMA_ENDPOINT) {
    this.modelName = modelName;
    this.endpoint = endpoint;
  }

  async available(): Promise<boolean> {
    try {
      const r = await fetch(`${this.endpoint}/api/tags`);
      return r.ok;
    } catch {
      return false;
    }
  }

  async complete(p: PromptPayload): Promise<LLMResponse> {
    const r = await fetch(`${this.endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.modelName,
        messages: [
          { role: 'system', content: p.systemPrompt },
          { role: 'user', content: p.userPrompt },
        ],
        stream: false,
        options: { temperature: p.temperature ?? 0.6, num_predict: p.maxTokens ?? 400 },
      }),
    });
    if (!r.ok) throw new Error(`Ollama responded ${r.status}`);

    const json = (await r.json()) as OllamaChatResponse;
    return {
      text: json.message?.content ?? '',
      parsed: parseStructuredResponse(json.message?.content ?? '') ?? undefined,
      modelName: this.modelName,
      usage:
        json.prompt_eval_count !== undefined
          ? { input: json.prompt_eval_count, output: json.eval_count ?? 0 }
          : undefined,
    };
  }
}
