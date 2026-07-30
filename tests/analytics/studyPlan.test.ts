import { describe, expect, it } from 'vitest';
import { buildStudyPlan } from '../../src/analytics/studyPlan';
import type { StudySignals } from '../../src/hooks/useStudySignals';

const emptySignals: StudySignals = {
  analyzedGames: 0,
  avgMcl: null,
  structureSignals: [],
  ghostCount: 0,
  latestGhostId: null,
  blunderDna: [],
  recommendations: [],
  leakSignals: [],
};

describe('buildStudyPlan', () => {
  it('prioritizes the latest exact correction when automatic signals find a blunder pattern', () => {
    const plan = buildStudyPlan('auto', 3, {
      ...emptySignals,
      latestGhostId: 'ghost-1',
      blunderDna: [{ key: 'early-queen-commit', label: 'Early Queen Commitment', count: 2, examples: ['Qh5'] }],
    });
    expect(plan.title).toBe('Target: Early Queen Commitment');
    expect(plan.href).toBe('/drill?line=ghost-1');
  });

  it('honors an explicit structure focus over automatic review selection', () => {
    const plan = buildStudyPlan('structures', 3, {
      ...emptySignals,
      ghostCount: 2,
    });
    expect(plan.href).toBe('/training/structures');
    expect(plan.action).toBe('Open structure training');
  });

  it('falls back to due reviews when no game signal exists', () => {
    const plan = buildStudyPlan('auto', 2, emptySignals);
    expect(plan.href).toBe('/drill?queue=due');
    expect(plan.action).toBe('Review due lines');
  });
});

