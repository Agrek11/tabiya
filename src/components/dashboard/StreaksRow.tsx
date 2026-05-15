/**
 * StreaksRow — dashboard two-card grid for drill-day + line-mastery streaks.
 *
 * Both cards show the streak value, label, and a muted "Start a drill to
 * begin" caption when value === 0 (R2.4-5).
 */

import { Flame, CheckCircle } from 'lucide-react';
import { Card } from '../../ui/primitives/Card';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { useStreaks } from '../../hooks/useStreaks';

export function StreaksRow() {
  const { drillDayStreak, lineMasteryStreak } = useStreaks();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      <StreakCard
        label="Days in a row"
        value={drillDayStreak}
        icon="flame"
        muted={drillDayStreak === 0}
        caption={drillDayStreak === 0 ? 'Start a drill to begin' : 'Daily streak'}
      />
      <StreakCard
        label="Clean lines in a row"
        value={lineMasteryStreak}
        icon="check"
        muted={lineMasteryStreak === 0}
        caption={
          lineMasteryStreak === 0
            ? 'Start a drill to begin'
            : 'No wrong moves'
        }
      />
    </div>
  );
}

function StreakCard({
  label,
  value,
  icon,
  muted,
  caption,
}: {
  label: string;
  value: number;
  icon: 'flame' | 'check';
  muted: boolean;
  caption: string;
}) {
  const t = useTokens();
  const Icon = icon === 'flame' ? Flame : CheckCircle;
  return (
    <Card padding={16}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 6,
          color: muted ? t.inkSoft : t.brand,
        }}
      >
        <Icon size={16} />
        <div
          style={{
            fontSize: 12,
            fontFamily: fonts.sans,
            fontWeight: 600,
            color: muted ? t.inkSoft : t.inkDim,
          }}
        >
          {label}
        </div>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: muted ? t.inkSoft : t.ink,
          fontFamily: fonts.sans,
          letterSpacing: -0.5,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>
        {caption}
      </div>
    </Card>
  );
}
