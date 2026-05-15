/**
 * AccuracyBadge — compact per-line accuracy chip.
 *
 * Renders nothing when `moves === 0` so the row stays clean for never-drilled
 * lines. Tone matches the dashboard `AccuracyRow` delta badge.
 */

import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';

export function AccuracyBadge({
  accuracy,
  moves,
}: {
  accuracy: number | null;
  moves: number;
}) {
  const t = useTokens();
  if (moves === 0 || accuracy === null) return null;
  const pct = (accuracy * 100).toFixed(1);
  const tone = accuracy >= 0.85 ? 'good' : accuracy >= 0.7 ? 'mid' : 'low';
  const bg =
    tone === 'good' ? t.successSoft : tone === 'mid' ? t.surfaceAlt : t.redSoft;
  const fg = tone === 'good' ? t.success : tone === 'mid' ? t.inkDim : t.red;
  return (
    <span
      title={`${pct}% over ${moves} move${moves === 1 ? '' : 's'}`}
      style={{
        fontSize: 10.5,
        fontFamily: fonts.mono,
        fontWeight: 600,
        padding: '1px 6px',
        borderRadius: radius.full,
        background: bg,
        color: fg,
        whiteSpace: 'nowrap',
      }}
    >
      {pct}%
    </span>
  );
}
