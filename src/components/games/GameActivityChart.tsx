/**
 * GameActivityChart — hand-rolled SVG bar chart for Games page placeholder data.
 *
 * Mirrors the Insights retention chart pattern (no chart lib). Real data wires
 * post-Phase 3 PKCE.
 */

import { useTokens } from '../../theme/ThemeContext';

const PLACEHOLDER_BARS = [0.4, 0.55, 0.68, 0.74, 0.62, 0.82];

export function GameActivityChart() {
  const t = useTokens();
  const height = 260;
  const usable = height - 16;
  return (
    <div style={{ height, display: 'flex', alignItems: 'flex-end', gap: 12, padding: '12px 8px 0' }}>
      {PLACEHOLDER_BARS.map((value, i) => {
        const isLast = i === PLACEHOLDER_BARS.length - 1;
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${value * usable}px`,
              background: isLast ? t.brand : t.brandSoft,
              borderRadius: '10px 10px 4px 4px',
              transition: 'background 200ms ease',
            }}
          />
        );
      })}
    </div>
  );
}
