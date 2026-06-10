/**
 * DailyActivityGrid — GitHub-style 53-week × 7-day SVG grid.
 *
 * Aggregates `line_start` events by local-calendar day. 5-tier color buckets:
 * 0 / 1 / 2-3 / 4-7 / 8+. Today is the rightmost column; week starts Sunday
 * (leftmost row). Hand-rolled SVG — no chart library (R7.8 budget).
 *
 * Cells use classname `heatmap-cell` to be distinct from the board's
 * square-highlight primitive (Article 15, design §3.6).
 */

import { useMemo } from 'react';
import { useTokens } from '../../../theme/ThemeContext';
import { fonts } from '../../../theme/tokens';
import { localDayKey } from '../../../hooks/streaks/computeStreaks';
import type { SessionEvent } from '../../../types/events';

const WEEKS = 53;
const DAYS = 7;
const CELL = 12;
const GAP = 2;

const BUCKETS: readonly { min: number; max: number; intensity: number }[] = [
  { min: 0, max: 0, intensity: 0 },
  { min: 1, max: 1, intensity: 1 },
  { min: 2, max: 3, intensity: 2 },
  { min: 4, max: 7, intensity: 3 },
  { min: 8, max: Infinity, intensity: 4 },
];

function bucketFor(count: number): number {
  for (const b of BUCKETS) {
    if (count >= b.min && count <= b.max) return b.intensity;
  }
  return 0;
}

export function DailyActivityGrid({ events }: { events: SessionEvent[] }) {
  const t = useTokens();
  const fills = useMemo(
    () => [t.surfaceAlt, t.brandSoft, t.brand, t.brand, t.brand] as const,
    [t]
  );
  const opacities = [1, 0.4, 0.6, 0.85, 1];

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of events) {
      if (e.eventType !== 'line_start') continue;
      const key = localDayKey(e.timestamp);
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return map;
  }, [events]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayDow = today.getDay(); // 0 = Sunday

  // Total cells rendered: 53 * 7. Rightmost column ends at today. So column
  // index 52 contains today's Sunday week up through today's day-of-week.
  const cells: Array<{ x: number; y: number; count: number; key: string }> = [];
  // Start date = today minus ((WEEKS - 1) * 7 + todayDow) days, i.e., the
  // Sunday at the leftmost column.
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - ((WEEKS - 1) * 7 + todayDow));

  for (let col = 0; col < WEEKS; col++) {
    for (let row = 0; row < DAYS; row++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + col * 7 + row);
      if (d.getTime() > today.getTime()) continue; // skip future cells in the partial week
      const key = localDayKey(d.getTime());
      cells.push({
        x: col * (CELL + GAP),
        y: row * (CELL + GAP),
        count: counts.get(key) ?? 0,
        key: `${d.toISOString().slice(0, 10)}`,
      });
    }
  }

  const width = WEEKS * (CELL + GAP);
  const height = DAYS * (CELL + GAP);

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg
        viewBox={`0 0 ${width} ${height + 22}`}
        width="100%"
        style={{ maxWidth: width, display: 'block' }}
        role="img"
        aria-label="Daily drill activity"
      >
        {cells.map((c) => {
          const b = bucketFor(c.count);
          return (
            <rect
              key={c.key}
              className="heatmap-cell"
              x={c.x}
              y={c.y}
              width={CELL}
              height={CELL}
              rx={2}
              ry={2}
              fill={fills[b]}
              fillOpacity={opacities[b]}
              stroke={c.count === 0 ? t.border : 'none'}
              strokeWidth={c.count === 0 ? 0.5 : 0}
            >
              <title>
                {c.key}: {c.count} {c.count === 1 ? 'line' : 'lines'}
              </title>
            </rect>
          );
        })}
        {/* Legend */}
        <g transform={`translate(0, ${height + 6})`}>
          <text
            x={0}
            y={10}
            fontSize={9}
            fontFamily={fonts.sans}
            fill={t.inkSoft}
          >
            Less
          </text>
          {BUCKETS.map((_b, i) => (
            <rect
              key={i}
              className="heatmap-cell"
              x={28 + i * (CELL + 2)}
              y={1}
              width={CELL}
              height={CELL}
              rx={2}
              ry={2}
              fill={fills[i]}
              fillOpacity={opacities[i]}
            />
          ))}
          <text
            x={28 + BUCKETS.length * (CELL + 2) + 4}
            y={10}
            fontSize={9}
            fontFamily={fonts.sans}
            fill={t.inkSoft}
          >
            More
          </text>
        </g>
      </svg>
    </div>
  );
}
