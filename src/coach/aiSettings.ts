/**
 * aiSettings — typed read/write helpers for the AI provider configuration,
 * the localStorage persistence boundary for the Coach's LLM choice
 * (Article 11). Single source of truth for the key strings so the Settings UI,
 * the DI container, and `useCoach` cache invalidation all agree.
 *
 * Key convention matches the rest of the app: colon-delimited `tabiya:ai:*`.
 * The API key lives here too — see AISection.tsx for the documented threat
 * model. It is NEVER logged, snapshotted, or sent anywhere but the provider.
 */

export type InferenceLocation = 'cloud' | 'ollama' | 'webgpu';
export type CloudProvider = 'anthropic' | 'openai';

export const AI_STORAGE_KEYS = {
  location: 'tabiya:ai:location',
  provider: 'tabiya:ai:provider',
  model: 'tabiya:ai:model',
  apiKey: 'tabiya:ai:apiKey',
} as const;

/** Window event fired when AI settings are saved, so `useCoach` drops cache. */
export const AI_SETTINGS_CHANGED_EVENT = 'tabiya:ai-settings-changed';

function read(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null || value === '') window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* quota / private mode — silently degrade */
  }
}

export type AISettings = {
  location: InferenceLocation;
  provider: CloudProvider;
  model: string;
  apiKey: string;
};

export function loadAISettings(): AISettings {
  const apiKey = read(AI_STORAGE_KEYS.apiKey) ?? '';
  const rawLocation = read(AI_STORAGE_KEYS.location);
  const location: InferenceLocation =
    rawLocation === 'cloud' || rawLocation === 'ollama' || rawLocation === 'webgpu'
      ? rawLocation
      : apiKey
        ? 'cloud'
        : 'ollama';
  const rawProvider = read(AI_STORAGE_KEYS.provider);
  const provider: CloudProvider = rawProvider === 'openai' ? 'openai' : 'anthropic';
  return {
    location,
    provider,
    model: read(AI_STORAGE_KEYS.model) ?? '',
    apiKey,
  };
}

/** Persist settings and notify in-tab listeners (cache invalidation). */
export function saveAISettings(patch: Partial<AISettings>): void {
  if (patch.location !== undefined) write(AI_STORAGE_KEYS.location, patch.location);
  if (patch.provider !== undefined) write(AI_STORAGE_KEYS.provider, patch.provider);
  if (patch.model !== undefined) write(AI_STORAGE_KEYS.model, patch.model);
  if (patch.apiKey !== undefined) write(AI_STORAGE_KEYS.apiKey, patch.apiKey);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AI_SETTINGS_CHANGED_EVENT));
  }
}

/** Clear the API key from storage. In-memory client cache is dropped by the
 *  container's `_clearClientCache` (called by the UI's Clear-key handler). */
export function clearApiKey(): void {
  write(AI_STORAGE_KEYS.apiKey, null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AI_SETTINGS_CHANGED_EVENT));
  }
}
