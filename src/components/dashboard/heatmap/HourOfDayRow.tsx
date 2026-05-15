/**
 * HourOfDayRow — 24-cell row showing drill activity by hour of local day.
 *
 * Tallies `line_start` count per local hour. 5-tier bucket scaled for
 * hourly counts: 0 / 1-2 / 3-5 / 6-10 / 11+. Tick labels at 0, 6, 12, 18, 23.
 *
 * Cells use `heatmap-cell` class (Article 15 — distinct from board highlights).
 */

import { useMemo } from 'react';
import { useTokens } from '../../../theme/ThemeContext';
import { fonts, radius } from '../../../theme/tokens';
import type { SessionEvent } from '../../../types/events';

const HOURS = 24;

const BUCKETS: readonly { min: number; max: number; intensity: number }[] = [
  { min: 0, max: 0, intensity: 0 },
  { min: 1, max: 2, intensity: 1 },
  { min: 3, max: 5, intensity: 2 },
  { min: 6, max: 10, intensity: 3 },
  { min: 11, max: Infinity, intensity: 4 },
];

function bucketFor(count: number): number {
  for (const b of BUCKETS) {
    if (count >= b.min && count <= b.max) return b.intensity;
  }
  return 0;
}

const TICK_HOURS = [0, 6, 12, 18, 23];

export function HourOfDayRow({ events }: { events: SessionEvent[] }) {
  const t = useTokens();
  const fills = [t.surfaceAlt, t.brandSoft, t.brand, t.brand, t.brand] as const;
  const opacities = [1, 0.4, 0.6, 0.85, 1];

  const counts = useMemo(() => {
    const arr = new Array<number>(HOURS).fill(0);
    for (const e of events) {
      if (e.eventType !== 'line_start') continue;
      const h = new Date(e.timestamp).getHours();
      arr[h] = (arr[h] ?? 0) + 1;
    }
    return arr;
  }, [events]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${HOURS}, 1fr)`,
          gap: 3,
        }}
      >
        {counts.map((c, hour) => {
          const b = bucketFor(c);
          return (
            <div
              key={hour}
              className="heatmap-cell"
              title={`${hour.toString().padStart(2, '0')}:00 — ${c} ${c === 1 ? 'line' : 'lines'}`}
              style={{
                height: 28,
                borderRadius: radius.chip,
                background: fills[b],
                opacity: opacities[b],
                border:
                  c === 0
                    ? `1px solid ${t.border}`
                    : `1px solid transparent`,
              }}
            />
          );
        })}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${HOURS}, 1fr)`,
          gap: 3,
        }}
      >
        {Array.from({ length: HOURS }, (_, h) => (
          <div
            key={h}
            style={{
              fontSize: 9,
              fontFamily: fonts.mono,
              color: t.inkSoft,
              textAlign: 'center',
            }}
          >
            {TICK_HOURS.includes(h) ? h.toString().padStart(2, '0') : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
