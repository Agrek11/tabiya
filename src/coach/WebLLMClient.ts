/**
 * WebLLMClient — the FREE Coach tier: in-browser WebGPU inference via MLC
 * web-llm (4a.1, closing 4a Open Question #2). No API key, no install, no
 * server — the model (~1 GB) downloads once and lives in the browser cache.
 *
 * Replaces the 4a `LlamaCppWebGPULLMClient` skeleton; runtime is MLC's
 * web-llm (Apache-2.0, declared in tech.md), driven directly per Article 3 —
 * no orchestration framework.
 *
 * Bundle discipline (Article 11, R9.7): web-llm is dynamic-imported on the
 * first `complete()` call, so it ships as its own lazy chunk exactly like the
 * Anthropic/OpenAI SDKs. Engine instances are cached per model for the
 * session — the expensive part (model fetch + GPU compile) happens once.
 *
 * Quality expectation: a 1.5B-class model narrates noticeably below Haiku.
 * That is the documented trade — free + fully private vs sharper prose. The
 * 4b+ symbolic layers will matter MORE for this tier, not less.
 */

import { getWebgpuLlmFlag } from '../storage/featureFlags';
import type { LLMClient, LLMResponse, PromptPayload, ProviderName } from './LLMClient';
import { parseStructuredResponse } from './parseStructuredResponse';

export const DEFAULT_WEBGPU_MODEL = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

export type WebLLMProgress = { text: string; progress: number };

// Session-scoped engine cache — keyed by model id. The promise is cached (not
// the engine) so concurrent first calls share one download (single-flight).
type Engine = import('@mlc-ai/web-llm').MLCEngineInterface;
const engineCache = new Map<string, Promise<Engine>>();

/** Test/teardown escape hatch. */
export function _clearWebLLMEngineCacheForTesting(): void {
  engineCache.clear();
}

function loadEngine(modelName: string, onProgress?: (p: WebLLMProgress) => void): Promise<Engine> {
  let cached = engineCache.get(modelName);
  if (!cached) {
    cached = import('@mlc-ai/web-llm').then((webllm) =>
      webllm.CreateMLCEngine(modelName, {
        initProgressCallback: (report) =>
          onProgress?.({ text: report.text, progress: report.progress }),
      }),
    );
    cached.catch(() => engineCache.delete(modelName)); // failed load is retryable
    engineCache.set(modelName, cached);
  }
  return cached;
}

export class WebLLMClient implements LLMClient {
  readonly providerName: ProviderName = 'local-webgpu';
  readonly modelName: string;
  private readonly onProgress?: (p: WebLLMProgress) => void;

  constructor(modelName: string = DEFAULT_WEBGPU_MODEL, onProgress?: (p: WebLLMProgress) => void) {
    this.modelName = modelName;
    this.onProgress = onProgress;
  }

  async available(): Promise<boolean> {
    const hasGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
    return hasGpu && getWebgpuLlmFlag();
  }

  async complete(p: PromptPayload): Promise<LLMResponse> {
    const engine = await loadEngine(this.modelName, this.onProgress);
    const res = await engine.chat.completions.create({
      messages: [
        { role: 'system', content: p.systemPrompt },
        { role: 'user', content: p.userPrompt },
      ],
      max_tokens: p.maxTokens ?? 400,
      temperature: p.temperature ?? 0.6,
      stop: p.stops,
    });
    const text = res.choices[0]?.message.content ?? '';
    return {
      text,
      parsed: parseStructuredResponse(text) ?? undefined,
      modelName: this.modelName,
      usage: res.usage
        ? { input: res.usage.prompt_tokens, output: res.usage.completion_tokens }
        : undefined,
    };
  }
}
