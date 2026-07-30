import type { StudySignals } from '../hooks/useStudySignals';
import type { StudyFocus } from '../hooks/useStudyFocus';

export type StudyPlan = {
  title: string;
  reason: string;
  href: string;
  action: string;
};

export function buildStudyPlan(
  focus: StudyFocus,
  dueCount: number,
  signals: StudySignals,
): StudyPlan {
  if (focus === 'structures') {
    return {
      title: 'Train your recurring structures',
      reason: signals.ghostCount > 0
        ? signals.ghostCount + ' correction drill' + (signals.ghostCount === 1 ? ' is' : 's are') + ' grouped by structure.'
        : 'Structure training will be ready as soon as game corrections are added.',
      href: '/training/structures',
      action: 'Open structure training',
    };
  }
  if (focus === 'corrections') {
    return {
      title: signals.latestGhostId ? 'Rehearse your latest game correction' : 'Create your first correction drill',
      reason: signals.latestGhostId
        ? 'This turns a detected out-of-book moment into a repeatable drill.'
        : 'Review a game to turn an opening mistake into a targeted drill.',
      href: signals.latestGhostId ? '/drill?line=' + encodeURIComponent(signals.latestGhostId) : '/games',
      action: signals.latestGhostId ? 'Drill correction' : 'Review games',
    };
  }
  if (focus === 'review') {
    return {
      title: dueCount > 0 ? dueCount + ' line' + (dueCount === 1 ? '' : 's') + ' due for review' : 'Reinforce your repertoire',
      reason: dueCount > 0
        ? 'Spaced repetition is the highest-value next session.'
        : 'No lines are due. Choose any line and deepen recall.',
      href: dueCount > 0 ? '/drill?queue=due' : '/drill',
      action: dueCount > 0 ? 'Review due lines' : 'Open drills',
    };
  }

  const flaggedLeak = signals.leakSignals.find((signal) => signal.flagged);
  const pattern = signals.blunderDna[0];
  if (signals.latestGhostId && pattern) {
    return {
      title: 'Target: ' + pattern.label,
      reason: pattern.count + ' game correction' + (pattern.count === 1 ? '' : 's') + ' point to this pattern. Rehearse the latest exact position.',
      href: '/drill?line=' + encodeURIComponent(signals.latestGhostId),
      action: 'Drill correction',
    };
  }
  if (flaggedLeak) {
    return {
      title: 'Review recurring ' + flaggedLeak.key.replace('recurring:', ''),
      reason: flaggedLeak.games + ' games average ' + flaggedLeak.mcl + ' centipawns lost in this recurring decision.',
      href: dueCount > 0 ? '/drill?queue=due' : '/drill',
      action: dueCount > 0 ? 'Review due lines' : 'Open drills',
    };
  }
  return {
    title: dueCount > 0 ? dueCount + ' line' + (dueCount === 1 ? '' : 's') + ' due for review' : 'Build your next repetition',
    reason: dueCount > 0
      ? 'Clear the spaced-repetition queue before adding new material.'
      : 'Drill a repertoire line to create your next personalized review.',
    href: dueCount > 0 ? '/drill?queue=due' : '/drill',
    action: dueCount > 0 ? 'Review due lines' : 'Open drills',
  };
}

