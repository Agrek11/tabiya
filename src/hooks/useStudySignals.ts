import { useEffect, useState } from 'react';
import { clusterGhostBlunders, type BlunderDnaCluster } from '../analysis/blunderDna';
import { computeMcl, detectLeaks, type LeakScore } from '../analysis/leakDetector';
import { recommendationsFromDna, type StudyRecommendation } from '../analysis/recommendations';
import { getGameAnalysisRepository, getGhostLineRepository } from '../storage';

export type StructureSignal = {
  label: string;
  count: number;
};

export type StudySignals = {
  analyzedGames: number;
  avgMcl: number | null;
  structureSignals: StructureSignal[];
  ghostCount: number;
  latestGhostId: string | null;
  blunderDna: BlunderDnaCluster[];
  recommendations: StudyRecommendation[];
  leakSignals: LeakScore[];
};

const EMPTY: StudySignals = {
  analyzedGames: 0,
  avgMcl: null,
  structureSignals: [],
  ghostCount: 0,
  latestGhostId: null,
  blunderDna: [],
  recommendations: [],
  leakSignals: [],
};

export function useStudySignals(): StudySignals {
  const [signals, setSignals] = useState<StudySignals>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [analyses, ghosts] = await Promise.all([
          getGameAnalysisRepository().listAll(),
          getGhostLineRepository().listAll(),
        ]);
        const mcls = analyses.map(computeMcl).filter((value) => Number.isFinite(value));
        const leakSignals = detectLeaks(
          analyses,
          (analysis) => {
            const top = analysis.plies
              .map((ply) => ({ cpLoss: Number(ply.cpLoss), san: String(ply.san ?? '') }))
              .filter((ply) => Number.isFinite(ply.cpLoss))
              .sort((a, b) => b.cpLoss - a.cpLoss)[0];
            return top?.san ? 'recurring:' + top.san : 'recurring:unknown';
          },
          { minMcl: 70, minGames: 2 },
        );
        const blunderDna = clusterGhostBlunders(ghosts);
        const structureSignals = [...ghosts.reduce((buckets, ghost) => {
          const label = ghost.tags.some((tag) => tag.includes('iqp')) ? 'IQP'
            : ghost.tags.some((tag) => tag.includes('stonewall')) ? 'Stonewall'
              : ghost.tags.some((tag) => tag.includes('maroczy')) ? 'Maroczy'
                : ghost.tags.some((tag) => tag.includes('symmetric')) ? 'Symmetric'
                  : 'General structure';
          buckets.set(label, (buckets.get(label) ?? 0) + 1);
          return buckets;
        }, new Map<string, number>()).entries()]
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
        if (cancelled) return;
        setSignals({
          analyzedGames: analyses.length,
          avgMcl: mcls.length > 0 ? Math.round(mcls.reduce((a, b) => a + b, 0) / mcls.length) : null,
          ghostCount: ghosts.length,
          latestGhostId: [...ghosts].sort((a, b) => b.created_at - a.created_at)[0]?.id ?? null,
          blunderDna,
          structureSignals,
          recommendations: recommendationsFromDna(blunderDna),
          leakSignals,
        });
      } catch (error) {
        console.error('useStudySignals failed:', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return signals;
}

