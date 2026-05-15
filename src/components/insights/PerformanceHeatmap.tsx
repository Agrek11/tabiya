/**
 * PerformanceHeatmap — 6×2 grid of intensity cells, matching v1 preview
 * `.heatmap-grid`. Placeholder until Phase 1.5 per-opening retention is
 * available; cell intensity feeds from a static ramp.
 */

import { useTokens } from '../../theme/ThemeContext';

const RAMP = [0.15, 0.25, 0.38, 0.55, 0.7, 1.0, 0.24, 0.31, 0.47, 0.6, 0.76, 1.0];

function blend(hex: string, alpha: number, fallback: string): string {
  // The brand color may be a hex (light) or rgba (dark) — use the token directly
  // for full intensity, alpha-modulate for partial. We avoid extra parsing
  // complexity by emitting rgba() when the token is hex; otherwise we fall
  // through to a soft default for very transparent cells.
  if (alpha >= 0.99) return hex;
  if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
    const r = parseInt(hex.length === 7 ? hex.slice(1, 3) : hex.slice(1, 2).repeat(2), 16);
    const g = parseInt(hex.length === 7 ? hex.slice(3, 5) : hex.slice(2, 3).repeat(2), 16);
    const b = parseInt(hex.length === 7 ? hex.slice(5, 7) : hex.slice(3, 4).repeat(2), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return fallback;
}

export function PerformanceHeatmap() {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 8,
        marginTop: 14,
      }}
    >
      {RAMP.map((intensity, i) => (
        <div
          key={i}
          style={{
            height: 38,
            borderRadius: 8,
            background: blend(t.brand, intensity, t.brandSoft),
          }}
        />
      ))}
    </div>
  );
}
