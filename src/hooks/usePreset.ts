/**
 * usePreset — read/write the active repertoire preset.
 *
 * Stored in localStorage as the preset id, or 'custom' / null for no preset
 * (show all families). Returns the resolved Preset object plus a setter.
 */

import { useCallback, useEffect, useState } from 'react';
import { getRepository } from '../storage';
import type { Preset } from '../storage/types';

const KEY = 'tabiya.repertoirePreset';

function readId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw === null || raw === '' || raw === 'custom') return null;
    return raw;
  } catch {
    return null;
  }
}

function writeId(id: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (id === null) window.localStorage.removeItem(KEY);
    else window.localStorage.setItem(KEY, id);
  } catch {
    /* quota / private */
  }
}

export function usePreset(): {
  preset: Preset | null;
  presets: Preset[];
  setPresetId: (id: string | null) => void;
  loading: boolean;
} {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activeId, setActiveId] = useState<string | null>(() => readId());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void getRepository()
      .listPresets()
      .then((list) => {
        if (!cancelled) {
          setPresets(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPresetId = useCallback((id: string | null) => {
    writeId(id);
    setActiveId(id);
  }, []);

  const preset = activeId === null ? null : presets.find((p) => p.id === activeId) ?? null;
  return { preset, presets, setPresetId, loading };
}

/** Pure helper: does a family pass the preset filter? */
export function familyPassesPreset(
  familyId: string,
  familyTier: number,
  preset: Preset | null
): boolean {
  if (preset === null) return true;
  if (preset.family_ids.length > 0 && preset.family_ids.includes(familyId)) return true;
  if (preset.tier_band.length === 0 && preset.family_ids.length === 0) return true;
  return preset.tier_band.includes(familyTier);
}
