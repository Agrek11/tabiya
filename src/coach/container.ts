/**
 * container — DI for the Coach's LLM client (Task 5.6, Article 5).
 *
 * `getLLMClient()` reads the persisted AI settings and returns the configured
 * concrete `LLMClient`, or `null` when nothing usable is configured (→ the
 * surface renders engine-only degraded mode, R5.5). Surfaces and the pipeline
 * depend ONLY on this function + the `LLMClient` interface — they never import
 * a concrete provider class.
 *
 * `_setLLMClientForTesting` injects a stub; `_clearClientCache` drops the
 * memoized client (used by the Clear-key handler so a wiped key cannot linger
 * in a cached instance — R6 security).
 */

import {
  AnthropicLLMClient,
  DEFAULT_ANTHROPIC_MODEL,
} from './AnthropicLLMClient';
import { OpenAILLMClient, DEFAULT_OPENAI_MODEL } from './OpenAILLMClient';
import { OllamaLLMClient, DEFAULT_OLLAMA_MODEL } from './OllamaLLMClient';
import { LlamaCppWebGPULLMClient, DEFAULT_WEBGPU_MODEL } from './LlamaCppWebGPULLMClient';
import { loadAISettings } from './aiSettings';
import type { LLMClient } from './LLMClient';

let testClient: LLMClient | null | undefined;

export function getLLMClient(): LLMClient | null {
  if (testClient !== undefined) return testClient;

  const s = loadAISettings();

  if (s.location === 'ollama') {
    return new OllamaLLMClient(s.model || DEFAULT_OLLAMA_MODEL);
  }
  if (s.location === 'webgpu') {
    return new LlamaCppWebGPULLMClient(s.model || DEFAULT_WEBGPU_MODEL);
  }
  // cloud
  if (!s.apiKey) return null;
  if (s.provider === 'openai') {
    return new OpenAILLMClient(s.model || DEFAULT_OPENAI_MODEL, s.apiKey);
  }
  return new AnthropicLLMClient(s.model || DEFAULT_ANTHROPIC_MODEL, s.apiKey);
}

/** Test-only: force a client (or `null` for degraded mode). */
export function _setLLMClientForTesting(client: LLMClient | null): void {
  testClient = client;
}

/** Test-only: revert to reading real settings. */
export function _resetLLMClientForTesting(): void {
  testClient = undefined;
}

/** No-op placeholder for symmetry with future cached-instance designs; the
 *  client is constructed per-call in 4a so there is nothing to evict, but the
 *  Clear-key handler calls this to remain correct if caching is added later. */
export function _clearClientCache(): void {
  /* per-call construction in 4a — nothing cached */
}
