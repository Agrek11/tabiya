/**
 * Engine presets — single source of truth for the three search profiles the
 * user picks in Settings. No raw depth/multipv knobs are exposed to the UI
 * (R3.3); the user chooses a named profile and this module maps it to
 * `EngineOpts`.
 *
 * Persistence boundary is `localStorage` (Article 11). Key convention matches
 * the rest of the app: colon-delimited `tabiya:<area>:<name>`.
 */

import type { EngineOpts } from './ChessEngine';

export const ENGINE_PRESETS = {
  Fast: { depth: 12, multipv: 3, movetimeMs: 500 },
  Balanced: { depth: 20, multipv: 3, movetimeMs: 2000 },
  Deep: { depth: 30, multipv: 5, movetimeMs: 5000 },
} as const satisfies Record<string, EngineOpts>;

export type EnginePresetName = keyof typeof ENGINE_PRESETS;

export const ENGINE_PRESET_NAMES = Object.keys(ENGINE_PRESETS) as EnginePresetName[];

const DEFAULT_PRESET: EnginePresetName = 'Balanced';

/** localStorage key holding the selected preset name. */
export const ENGINE_PRESET_STORAGE_KEY = 'tabiya:engine:preset';

/**
 * Window CustomEvent dispatched when the preset changes, so `useCoach` can
 * drop its in-memory cache (a `storage` event does NOT fire in the same tab
 * that wrote the value — hence the explicit event).
 */
export const ENGINE_PRESET_CHANGED_EVENT = 'tabiya:engine-preset-changed';

/** Resolve a preset name to its concrete `EngineOpts`. */
export function getEnginePreset(name: EnginePresetName): EngineOpts {
  return ENGINE_PRESETS[name];
}

function isPresetName(v: string | null): v is EnginePresetName {
  return v !== null && Object.prototype.hasOwnProperty.call(ENGINE_PRESETS, v);
}

/** Read the persisted preset name, defaulting to Balanced. SSR-safe. */
export function loadPresetFromStorage(): EnginePresetName {
  if (typeof window === 'undefined') return DEFAULT_PRESET;
  try {
    const v = window.localStorage.getItem(ENGINE_PRESET_STORAGE_KEY);
    return isPresetName(v) ? v : DEFAULT_PRESET;
  } catch {
    return DEFAULT_PRESET;
  }
}

/**
 * Persist the preset and notify in-tab listeners (cache invalidation). UI
 * calls this on radio change.
 */
export function savePresetToStorage(name: EnginePresetName): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ENGINE_PRESET_STORAGE_KEY, name);
    window.dispatchEvent(new CustomEvent(ENGINE_PRESET_CHANGED_EVENT, { detail: { name } }));
  } catch {
    /* quota / private mode — silently degrade */
  }
}
