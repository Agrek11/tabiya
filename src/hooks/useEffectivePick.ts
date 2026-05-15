/**
 * useEffectivePick — replaces Phase 1c's `usePreset`.
 *
 * Loads:
 *   - the persisted `RepertoirePick` from `RepertoireRepository`
 *   - the curated `Preset[]` from the catalog
 *   - the full catalog `lineIds` (used by the 'off' branch + legacy derivation)
 *
 * Pipes them through `computeEffectivePick` and returns the result plus a
 * `savePick(next)` writer that persists and recomputes.
 *
 * The Phase 1c `localStorage` preset key is read once and migrated into the
 * IDB pick on first run — a no-network, no-prompt upgrade.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PICK,
  getRepertoireRepository,
  getRepository,
  type EffectivePick,
  type Preset,
  type RepertoirePick,
  type RepertoirePreset,
} from '../storage';
import { computeEffectivePick, type LineMeta } from '../repertoire/effectivePick';

const LOCAL_STORAGE_LEGACY_KEY = 'tabiya.repertoirePreset';

interface UseEffectivePickReturn {
  effective: EffectivePick;
  pick: RepertoirePick;
  presets: RepertoirePreset[];
  loading: boolean;
  savePick: (next: RepertoirePick) => Promise<void>;
}

/** Convert Phase 1c `Preset` → Phase 1.5 `RepertoirePreset` (lines defaults
 *  to empty, triggering legacy tier/family derivation in the resolver). */
function liftPreset(p: Preset): RepertoirePreset {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    tier_band: p.tier_band,
    family_ids: p.family_ids,
    lines: p.lines ?? [],
    recommended_color: p.recommended_color,
  };
}

const OFF_PRESET: RepertoirePreset = {
  id: 'off',
  name: 'Off — show all',
  description: 'Browse the full catalog. No filter.',
  tier_band: [],
  family_ids: [],
  lines: [],
  recommended_color: 'both',
};

export function useEffectivePick(): UseEffectivePickReturn {
  const [pick, setPick] = useState<RepertoirePick>(DEFAULT_PICK);
  const [presets, setPresets] = useState<RepertoirePreset[]>([OFF_PRESET]);
  const [lineMeta, setLineMeta] = useState<ReadonlyMap<string, LineMeta>>(new Map());
  const [allLineIds, setAllLineIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const repo = getRepository();
        const repPresets = await repo.listPresets();
        const families = await repo.listFamilies();
        const openings = await repo.listOpenings();
        const lineLists = await Promise.all(openings.map((o) => repo.listLines(o.id)));
        const lines = lineLists.flat();
        if (cancelled) return;

        const opFam = new Map<string, string>();
        for (const o of openings) opFam.set(o.id, o.family_id);
        const famTier = new Map<string, number>();
        for (const f of families) famTier.set(f.id, f.tier);
        const meta = new Map<string, LineMeta>();
        for (const l of lines) {
          const fid = opFam.get(l.opening_id);
          if (fid === undefined) continue;
          meta.set(l.id, {
            familyId: fid,
            familyTier: famTier.get(fid) ?? 0,
          });
        }
        setLineMeta(meta);
        setAllLineIds(lines.map((l) => l.id));

        const presetList = [OFF_PRESET, ...repPresets.map(liftPreset)];
        setPresets(presetList);

        // Load persisted pick. Fall back to legacy localStorage preset.
        const stored = await getRepertoireRepository().getPick();
        let resolved: RepertoirePick = stored;
        if (
          stored.presetId === DEFAULT_PICK.presetId &&
          stored.additions.length === 0 &&
          stored.removals.length === 0
        ) {
          const legacy = readLegacyPresetId();
          if (legacy !== null && presetList.some((p) => p.id === legacy)) {
            resolved = { ...DEFAULT_PICK, presetId: legacy };
            // Persist the migrated value so subsequent loads see it natively.
            await getRepertoireRepository().savePick(resolved);
          }
        }
        if (!cancelled) {
          setPick(resolved);
          setLoading(false);
        }
      } catch (err) {
        console.error('useEffectivePick load failed:', err);
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const effective = useMemo<EffectivePick>(
    () => computeEffectivePick(pick, presets, allLineIds, lineMeta),
    [pick, presets, allLineIds, lineMeta]
  );

  const savePick = useCallback(async (next: RepertoirePick): Promise<void> => {
    await getRepertoireRepository().savePick(next);
    setPick(next);
  }, []);

  return { effective, pick, presets, loading, savePick };
}

function readLegacyPresetId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_LEGACY_KEY);
    if (raw === null || raw === '' || raw === 'custom') return null;
    return raw;
  } catch {
    return null;
  }
}
