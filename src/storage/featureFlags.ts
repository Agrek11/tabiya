/**
 * Feature flag registry — single source of truth for runtime feature toggles.
 *
 * Each flag is a typed read/write helper around `localStorage`. No string
 * literals for flag keys leak into hooks or UI — consumers call the typed
 * accessors below.
 *
 * Storage convention: `tabiya:flag:<name>` → `"true" | "false"`. Absent or
 * malformed → default. SSR-safe (`typeof window` guard).
 *
 * Constitution Article 11 (local-first): flags are stored on the user's
 * device only, never sent to any backend.
 * Constitution Article 14 (type discipline): no `any`, no string literals.
 */

const FLAG_KEY_PREFIX = 'tabiya:flag:';

function readFlag(key: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const v = window.localStorage.getItem(`${FLAG_KEY_PREFIX}${key}`);
    if (v === 'true') return true;
    if (v === 'false') return false;
    return defaultValue;
  } catch {
    return defaultValue;
  }
}

function writeFlag(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(`${FLAG_KEY_PREFIX}${key}`, value ? 'true' : 'false');
  } catch {
    /* quota / private mode — silently degrade */
  }
}

// ---------------------------------------------------------------------------
// Phase 1b — Explain Mode TTS flag (R6)
// ---------------------------------------------------------------------------

/**
 * `tabiya:flag:explainTts` — when on, Explain Mode speaks the per-ply
 * rationale aloud via `window.speechSynthesis`. Default off. Per-line mute
 * is handled separately under `tabiya:linePrefs:<lineId>:ttsMute`.
 */
export function getExplainTtsFlag(): boolean {
  return readFlag('explainTts', false);
}

export function setExplainTtsFlag(value: boolean): void {
  writeFlag('explainTts', value);
}

// ---------------------------------------------------------------------------
// Phase 4a — Coach: in-browser WebGPU LLM (R5.2, Open Question #2)
// ---------------------------------------------------------------------------

/**
 * `tabiya:flag:webgpuLlm` — when on, the AI Settings inference-location radio
 * offers "Local (Browser WebGPU)" and `LlamaCppWebGPULLMClient.available()`
 * may return true on WebGPU-capable devices. Default OFF in 4a — the client is
 * a skeleton; full in-browser model loading is deferred to a 4a.1 follow-up.
 *
 * Ollama is NOT behind a flag and needs no SDK — it is detected at runtime via
 * a raw `fetch` to `http://localhost:11434/api/tags` (see OllamaLLMClient).
 */
export function getWebgpuLlmFlag(): boolean {
  return readFlag('webgpuLlm', false);
}

export function setWebgpuLlmFlag(value: boolean): void {
  writeFlag('webgpuLlm', value);
}

/** Exported for tests that need to reset flag state directly. */
export const FLAG_STORAGE_KEYS = {
  explainTts: `${FLAG_KEY_PREFIX}explainTts`,
  webgpuLlm: `${FLAG_KEY_PREFIX}webgpuLlm`,
} as const;
