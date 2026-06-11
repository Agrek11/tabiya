/**
 * LLMClient — provider-agnostic narration surface (Phase 4a, Design §3).
 *
 * The Coach pipeline depends on this interface; concrete providers
 * (Anthropic / OpenAI / Ollama / llama.cpp-WebGPU) are wired by the DI
 * container (`src/coach/container.ts`). Article 3 — each impl calls its
 * provider SDK (or raw fetch) DIRECTLY; no LangChain/LlamaIndex/CrewAI.
 *
 * Forward-compat (R5.7): 4e returns structured JSON (cited tags/motifs/
 * features) for the hallucination post-validator. `LLMResponse.parsed` is the
 * escape hatch so adding that later does not break 4a callers.
 */

export type ProviderName =
  | 'cloud-anthropic'
  | 'cloud-openai'
  | 'local-ollama'
  | 'local-webgpu';

export type PromptPayload = {
  systemPrompt: string;
  userPrompt: string;
  stops?: string[];
  maxTokens?: number;
  temperature?: number;
};

export type TokenUsage = {
  input: number;
  output: number;
  /** Anthropic prompt-cache read hits — present on cache hits (R5.3). */
  cacheRead?: number;
};

export type LLMResponse = {
  text: string;
  modelName: string;
  usage?: TokenUsage;
  /** 4e JSON payload (tags_cited / motifs_cited / features_cited). Unused in 4a. */
  parsed?: unknown;
};

export type LLMChunk = { delta: string };

export interface LLMClient {
  complete(prompt: PromptPayload): Promise<LLMResponse>;
  /** Optional streaming surface (Surface C, 4e). */
  stream?(prompt: PromptPayload): AsyncIterable<LLMChunk>;
  readonly providerName: ProviderName;
  readonly modelName: string;
  /** Whether this client is usable right now (key present / endpoint reachable). */
  available(): Promise<boolean>;
}
