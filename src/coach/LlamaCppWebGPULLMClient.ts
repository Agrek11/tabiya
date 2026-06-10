/**
 * LlamaCppWebGPULLMClient — in-browser WebGPU inference SKELETON (Task 5.5).
 *
 * 4a ships the interface honored, not the implementation: `available()` gates
 * on `navigator.gpu` AND the `webgpuLlm` feature flag (default off). Actual
 * model loading (llama.cpp WASM/WebGPU) is deferred to a 4a.1 follow-up
 * (Open Question #2). `complete` throws until then.
 */

import { getWebgpuLlmFlag } from '../storage/featureFlags';
import type { LLMClient, LLMResponse, PromptPayload, ProviderName } from './LLMClient';

export const DEFAULT_WEBGPU_MODEL = 'llama-3.2-3b-instruct-q4';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class LlamaCppWebGPULLMClient implements LLMClient {
  readonly providerName: ProviderName = 'local-llamacpp-webgpu';
  readonly modelName: string;

  constructor(modelName: string = DEFAULT_WEBGPU_MODEL) {
    this.modelName = modelName;
  }

  async available(): Promise<boolean> {
    const hasGpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
    return hasGpu && getWebgpuLlmFlag();
  }

  async complete(_p: PromptPayload): Promise<LLMResponse> {
    throw new NotImplementedError(
      'WebGPU in-browser inference is not implemented in 4a (deferred to 4a.1). ' +
        'Use Cloud or Local (Ollama) for now.',
    );
  }
}
