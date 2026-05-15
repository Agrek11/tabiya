/**
 * StatCard — KPI tile matching v1 preview `.card` + `.stat-num` + `.stat-caption`.
 *
 * Tone:
 *   default  → ink color
 *   brand    → brand color (identity / retention)
 *   success  → success color (correctness / accuracy)
 *
 * `pending` renders an em-dash with a caption explaining the data is not yet
 * wired (Phase 1.5 / 2 placeholder).
 */

import type { ReactNode } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Card } from './Card';
import { CardTitle } from './CardTitle';

type Tone = 'default' | 'brand' | 'success';

type StatCardProps = {
  title: string;
  value: ReactNode;
  caption?: ReactNode;
  tone?: Tone;
  pending?: boolean;
};

export function StatCard({
  title,
  value,
  caption,
  tone = 'default',
  pending = false,
}: StatCardProps) {
  const t = useTokens();
  const color = pending ? t.inkSoft : tone === 'brand' ? t.brand : tone === 'success' ? t.success : t.ink;
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color,
          letterSpacing: '-0.02em',
          fontFamily: fonts.sans,
        }}
      >
        {pending ? '—' : value}
      </div>
      {caption && (
        <div
          style={{
            fontSize: 12,
            color: t.inkSoft,
            marginTop: 6,
            fontFamily: fonts.sans,
            fontStyle: pending ? 'italic' : 'normal',
          }}
        >
          {caption}
        </div>
      )}
    </Card>
  );
}
