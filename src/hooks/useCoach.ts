/**
 * useCoach — invokes the Coach pipeline with an in-memory, single-flight cache
 * (Task 8.3, Design §6).
 *
 * Cache key = `${lineId}::${plyIndex}::${enginePreset}::${modelName}` so a
 * preset OR model change can never serve a stale entry. Concurrent invocations
 * for the same key share one in-flight promise (anti-thundering-herd). The
 * cache is module-level (session-only; no IndexedDB in 4a) and cleared on any
 * engine-preset or AI-settings change (R3.6, R7.5, R9.5).
 */

import { useCallback, useState } from 'react';
import { CoachPipeline, type CoachResult } from '../coach/CoachPipeline';
import { getLLMClient } from '../coach/container';
import type { PlyHistoryEntry } from '../coach/CoachContext';
import {
  ENGINE_PRESET_CHANGED_EVENT,
  ENGINE_PRESET_STORAGE_KEY,
  loadPresetFromStorage,
} from '../engine/presets';
import { AI_SETTINGS_CHANGED_EVENT, AI_STORAGE_KEYS } from '../coach/aiSettings';

// Module-level cache shared across all hook instances (session-only).
const cache = new Map<string, Promise<CoachResult>>();

export function _clearCoachCache(): void {
  cache.clear();
}

// Register invalidation listeners once per session.
if (typeof window !== 'undefined') {
  window.addEventListener(ENGINE_PRESET_CHANGED_EVENT, _clearCoachCache);
  window.addEventListener(AI_SETTINGS_CHANGED_EVENT, _clearCoachCache);
  // `storage` fires for changes from OTHER tabs; filter to relevant keys.
  window.addEventListener('storage', (e: StorageEvent) => {
    if (
      e.key === ENGINE_PRESET_STORAGE_KEY ||
      e.key === AI_STORAGE_KEYS.provider ||
      e.key === AI_STORAGE_KEYS.model ||
      e.key === AI_STORAGE_KEYS.apiKey
    ) {
      _clearCoachCache();
    }
  });
}

function cacheKey(lineId: string | undefined, plyIndex: number | undefined): string {
  const preset = loadPresetFromStorage();
  const model = getLLMClient()?.modelName ?? 'none';
  return `${lineId ?? '?'}::${plyIndex ?? '?'}::${preset}::${model}`;
}

export type UseCoachInput = {
  lineId?: string;
  plyIndex?: number;
  fen: string;
  history: PlyHistoryEntry[];
};

export type UseCoachReturn = {
  result: CoachResult | null;
  loading: boolean;
  error: Error | null;
  invoke: () => void;
};

export function useCoach(input: UseCoachInput): UseCoachReturn {
  const { lineId, plyIndex, fen, history } = input;
  const [result, setResult] = useState<CoachResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const invoke = useCallback(() => {
    const key = cacheKey(lineId, plyIndex);
    let promise = cache.get(key);
    if (!promise) {
      promise = CoachPipeline.run({ fen, history, lineId, plyIndex });
      cache.set(key, promise);
    }
    setLoading(true);
    setError(null);
    promise.then(
      (r) => {
        setResult(r);
        setLoading(false);
      },
      (e: unknown) => {
        cache.delete(key); // don't cache a rejection
        setError(e instanceof Error ? e : new Error(String(e)));
        setLoading(false);
      },
    );
  }, [lineId, plyIndex, fen, history]);

  return { result, loading, error, invoke };
}
