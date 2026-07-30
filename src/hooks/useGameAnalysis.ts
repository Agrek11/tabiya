import { useEffect, useState } from 'react';
import { getGameAnalysisQueue } from '../analysis/GameAnalysisQueue';
import type { EnginePresetName } from '../engine/presets';
import type { GameAnalysis } from '../types/analysis';

type State =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; analysis: GameAnalysis }
  | { kind: 'error'; message: string };
type SettledState =
  | { key: string; kind: 'ready'; analysis: GameAnalysis }
  | { key: string; kind: 'error'; message: string };

export function useGameAnalysis(input: {
  gameId: string | null;
  pgn: string | null;
  enginePreset: EnginePresetName;
  maxPlies?: number;
}): State {
  const [settled, setSettled] = useState<SettledState | null>(null);
  const { gameId, pgn, enginePreset, maxPlies } = input;
  const hasInput = Boolean(gameId && pgn);
  const requestKey = hasInput ? `${gameId}::${enginePreset}::${maxPlies ?? 'all'}::${pgn}` : null;

  useEffect(() => {
    if (!hasInput || !gameId || !pgn || !requestKey) {
      return;
    }
    const q = getGameAnalysisQueue();
    void q
      .enqueue({ gameId, pgn, enginePreset, maxPlies })
      .then((analysis) => setSettled({ key: requestKey, kind: 'ready', analysis }))
      .catch((e) =>
        setSettled({
          key: requestKey,
          kind: 'error',
          message: e instanceof Error ? e.message : String(e),
        }),
      );
    return () => {
      q.cancel(gameId, enginePreset);
    };
  }, [enginePreset, gameId, hasInput, maxPlies, pgn, requestKey]);

  if (!hasInput || !requestKey) return { kind: 'idle' };
  if (!settled || settled.key !== requestKey) return { kind: 'loading' };
  return settled.kind === 'ready'
    ? { kind: 'ready', analysis: settled.analysis }
    : { kind: 'error', message: settled.message };
}
