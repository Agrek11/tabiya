/**
 * AccuracyRow — two cards side-by-side: all-time + last 7 days accuracy.
 *
 * Last-7-days card shows a delta badge `+1.2pp` / `-0.4pp` / `=`. Null
 * accuracy renders `—` with a "No moves yet" caption (R4.5).
 */

import { TrendingUp, Activity } from 'lucide-react';
import { Card } from '../../ui/primitives/Card';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';
import { useAccuracy, DELTA_NEUTRAL_EPSILON_PP } from '../../hooks/useAccuracy';

function formatPct(v: number | null): string {
  if (v === null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function formatDelta(delta: number | null): { text: string; tone: 'up' | 'down' | 'flat' } {
  if (delta === null) return { text: '', tone: 'flat' };
  if (Math.abs(delta) <= DELTA_NEUTRAL_EPSILON_PP) return { text: '=', tone: 'flat' };
  const sign = delta > 0 ? '+' : '';
  return {
    text: `${sign}${delta.toFixed(1)}pp`,
    tone: delta > 0 ? 'up' : 'down',
  };
}

export function AccuracyRow() {
  const { allTime, rolling7d, deltaPp } = useAccuracy();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 12,
      }}
    >
      <AccuracyCard
        label="All-time accuracy"
        accuracy={allTime.accuracy}
        moves={allTime.moves}
        icon="all"
      />
      <AccuracyCard
        label="Last 7 days"
        accuracy={rolling7d.accuracy}
        moves={rolling7d.moves}
        icon="recent"
        delta={deltaPp}
      />
    </div>
  );
}

function AccuracyCard({
  label,
  accuracy,
  moves,
  icon,
  delta,
}: {
  label: string;
  accuracy: number | null;
  moves: number;
  icon: 'all' | 'recent';
  delta?: number | null;
}) {
  const t = useTokens();
  const Icon = icon === 'all' ? Activity : TrendingUp;
  const isNull = accuracy === null;
  const deltaInfo = delta !== undefined ? formatDelta(delta) : null;
  return (
    <Card padding={16}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: isNull ? t.inkSoft : t.brand,
          }}
        >
          <Icon size={16} />
          <div
            style={{
              fontSize: 12,
              fontFamily: fonts.sans,
              fontWeight: 600,
              color: t.inkDim,
            }}
          >
            {label}
          </div>
        </div>
        {deltaInfo !== null && deltaInfo.text !== '' && (
          <span
            style={{
              fontSize: 11,
              fontFamily: fonts.mono,
              fontWeight: 600,
              padding: '2px 7px',
              borderRadius: radius.full,
              background:
                deltaInfo.tone === 'up'
                  ? t.brandSoft
                  : deltaInfo.tone === 'down'
                  ? 'rgba(226, 88, 34, 0.15)'
                  : t.surfaceAlt,
              color:
                deltaInfo.tone === 'up'
                  ? t.brand
                  : deltaInfo.tone === 'down'
                  ? t.red
                  : t.inkDim,
            }}
          >
            {deltaInfo.text}
          </span>
        )}
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: isNull ? t.inkSoft : t.ink,
          fontFamily: fonts.sans,
          letterSpacing: -0.5,
          marginBottom: 4,
        }}
      >
        {formatPct(accuracy)}
      </div>
      <div style={{ fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>
        {isNull ? 'No moves yet' : `${moves} move${moves === 1 ? '' : 's'}`}
      </div>
    </Card>
  );
}
