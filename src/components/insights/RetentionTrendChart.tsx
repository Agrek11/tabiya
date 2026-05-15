/**
 * RetentionTrendChart — hand-rolled SVG bar chart (Constitution Article 1, no
 * chart lib).
 *
 * Renders 6 bars at fixed heights — placeholder data until Phase 1.5 event
 * history is wired. The last bar is rendered in `t.brand`, the rest in
 * `t.brandSoft`, matching v1 preview `.chart-bar.active`.
 *
 * Bars are pure SVG so they theme via tokens at render time and need no extra
 * dependency.
 */

import { useTokens } from '../../theme/ThemeContext';

type Bar = { label: string; value: number };

const PLACEHOLDER_BARS: Bar[] = [
  { label: 'W1', value: 0.52 },
  { label: 'W2', value: 0.58 },
  { label: 'W3', value: 0.66 },
  { label: 'W4', value: 0.72 },
  { label: 'W5', value: 0.68 },
  { label: 'W6', value: 0.81 },
];

export function RetentionTrendChart({ bars = PLACEHOLDER_BARS }: { bars?: Bar[] }) {
  const t = useTokens();
  const height = 260;
  const padTop = 12;
  const padBottom = 4;
  const usable = height - padTop - padBottom;
  const gap = 12;
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap, padding: '12px 8px 0' }}>
      {bars.map((b, i) => {
        const isLast = i === bars.length - 1;
        return (
          <div
            key={b.label}
            style={{
              flex: 1,
              height: `${Math.max(0.04, b.value) * usable}px`,
              background: isLast ? t.brand : t.brandSoft,
              borderRadius: '10px 10px 4px 4px',
              transition: 'background 200ms ease',
            }}
            title={`${b.label}: ${Math.round(b.value * 100)}%`}
          />
        );
      })}
    </div>
  );
}
