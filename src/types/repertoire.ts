/**
 * Repertoire types — Phase 1.5 RepertoirePick over Phase 1c presets.
 *
 * `RepertoirePreset` extends Phase 1c's `Preset` with an explicit `lines:`
 * array; absent/empty `lines` falls back to tier/family derivation for
 * legacy presets (R5.1).
 *
 * `RepertoirePick` is the user's persisted override: a chosen `presetId` plus
 * per-line `additions` / `removals` deltas. `EffectivePick` is the computed
 * (preset.lines ∪ additions) \ removals view used by filter consumers.
 */

export interface RepertoirePreset {
  id: string;
  name: string;
  description: string;
  tier_band: number[];
  family_ids: string[];
  /** Phase 1.5 — explicit member line IDs. Empty for the synthetic `'off'`
   *  preset and for legacy presets that still rely on tier/family derivation. */
  lines: string[];
  recommended_color: 'white-only' | 'black-only' | 'both';
}

export interface RepertoirePick {
  presetId: string;
  additions: string[]; // lineIds added on top of preset
  removals: string[]; // lineIds removed from preset
}

export interface EffectivePick {
  lineIds: Set<string>;
  presetId: string;
  /** false when presetId === 'off' AND additions/removals are both empty. */
  isFiltered: boolean;
}

/** R5.9: default for a brand-new user. */
export const DEFAULT_PICK: RepertoirePick = {
  presetId: 'off',
  additions: [],
  removals: [],
};

/** Synthetic preset id meaning "no filter". */
export const OFF_PRESET_ID = 'off';
