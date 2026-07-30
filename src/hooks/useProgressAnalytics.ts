import { useEffect, useState } from 'react';
import { buildProgressSummary, type ProgressSummary } from '../analytics/progress';
import { getEventsBus, getEventsRepository, getRepository } from '../storage';

const EMPTY: ProgressSummary = buildProgressSummary([], []);

export function useProgressAnalytics(): { summary: ProgressSummary; loading: boolean } {
  const [summary, setSummary] = useState<ProgressSummary>(EMPTY);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const recompute = async (): Promise<void> => {
      try {
        const repository = getRepository();
        const [events, openings] = await Promise.all([
          getEventsRepository().listAll(),
          repository.listOpenings(),
        ]);
        const lineContexts = (
          await Promise.all(
            openings.map(async (opening) =>
              (await repository.listLines(opening.id)).map((line) => ({
                lineId: line.id,
                openingId: opening.id,
                openingName: opening.name,
              })),
            ),
          )
        ).flat();
        if (cancelled) return;
        setSummary(buildProgressSummary(events, lineContexts));
      } catch (error) {
        console.error('useProgressAnalytics recompute failed:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void recompute();
    const unsubscribe = getEventsBus().subscribe(() => void recompute());
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return { summary, loading };
}

