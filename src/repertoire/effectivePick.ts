/**
 * Effective pick computation — pure set algebra.
 *
 * Resolves a `RepertoirePick` (presetId + user deltas) against the catalog
 * + preset table into an `EffectivePick` whose `lineIds` is the final visible
 * set used by RepertoirePage, DrillPage, and the SRS queue filter.
 *
 * Algorithm:
 *   - presetId === 'off' → all catalog lineIds, then apply user deltas
 *     (additions are no-op since everything is already included; removals
 *     subtract).
 *   - preset with non-empty `lines` → start from preset.lines, apply deltas.
 *   - preset with empty `lines` (legacy) → derive from tier_band + family_ids
 *     via the provided `lineFamilyTier` lookup, then apply deltas.
 */

import {
  OFF_PRESET_ID,
  type EffectivePick,
  type RepertoirePick,
  type RepertoirePreset,
} from '../types/repertoire';

export interface LineMeta {
  /** Map from lineId → familyId (resolved via opening_id elsewhere). */
  familyId: string;
  /** Family tier 1..3 — used by legacy preset derivation. */
  familyTier: number;
}

export function computeEffectivePick(
  pick: RepertoirePick,
  presets: RepertoirePreset[],
  allLineIds: string[],
  lineMeta: ReadonlyMap<string, LineMeta> = new Map()
): EffectivePick {
  const preset = presets.find((p) => p.id === pick.presetId);
  const additions = new Set(pick.additions);
  const removals = new Set(pick.removals);

  // OFF: every catalog line, plus user additions (no-op), minus removals.
  if (preset === undefined || preset.id === OFF_PRESET_ID) {
    const base = new Set(allLineIds);
    for (const id of additions) base.add(id);
    for (const id of removals) base.delete(id);
    return {
      lineIds: base,
      presetId: pick.presetId,
      isFiltered: additions.size > 0 || removals.size > 0,
    };
  }

  // Preset with explicit `lines`: authoritative.
  // Preset with empty `lines`: legacy fallback to tier/family derivation.
  let base: Set<string>;
  if (preset.lines.length > 0) {
    base = new Set(preset.lines);
  } else {
    base = deriveFromTierAndFamily(preset, allLineIds, lineMeta);
  }
  for (const id of additions) base.add(id);
  for (const id of removals) base.delete(id);
  return { lineIds: base, presetId: pick.presetId, isFiltered: true };
}

/** Legacy preset derivation — included by tier OR by explicit family. */
function deriveFromTierAndFamily(
  preset: RepertoirePreset,
  allLineIds: string[],
  lineMeta: ReadonlyMap<string, LineMeta>
): Set<string> {
  const tierBand = new Set(preset.tier_band);
  const familyAllow = new Set(preset.family_ids);
  const out = new Set<string>();
  for (const id of allLineIds) {
    const meta = lineMeta.get(id);
    if (meta === undefined) continue;
    if (familyAllow.has(meta.familyId)) {
      out.add(id);
      continue;
    }
    if (tierBand.has(meta.familyTier)) out.add(id);
  }
  return out;
}
