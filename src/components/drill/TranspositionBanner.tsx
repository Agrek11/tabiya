/**
 * TranspositionBanner — Phase 2b non-blocking nudge above the move history
 * rail (R8).
 *
 * Presentational only — data comes from `useTransposition`. Per R8.5 the
 * banner is dismissable for the current session (local state, NOT
 * persisted). Re-mounting the component (new line, refresh) brings it
 * back if a match is still derived.
 *
 * Returns null when:
 *   - no matches (caller's hook is responsible for ply-0, empty-picks,
 *     and active-line filters),
 *   - the user dismissed it this session.
 *
 * Article 14 (type discipline): strict, no `any`.
 */

import { useState } from 'react';
import { X } from 'lucide-react';
import type { TranspositionMatch } from '../../hooks/useTransposition';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export interface TranspositionBannerProps {
  matches: readonly TranspositionMatch[];
  /** Count of matches truncated beyond the 3-cap (R8.3). */
  truncatedCount: number;
  /** Jump to the picked line via the drill route (R8.4). */
  onJump(lineId: string): void;
  /** Optional quick random jump across visible transposition matches. */
  onRoulette?(): void;
  /** Optional CTA to jump to a gambit transposition branch. */
  onDiversion?(): void;
}

export function TranspositionBanner({
  matches,
  truncatedCount,
  onJump,
  onRoulette,
  onDiversion,
}: TranspositionBannerProps): React.JSX.Element | null {
  const t = useTokens();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (matches.length === 0) return null;

  return (
    <div
      role="status"
      data-testid="transposition-banner"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        background: t.brandSoft,
        border: `0.5px solid ${t.brandSoftBorder}`,
        borderRadius: 10,
        fontFamily: fonts.sans,
        fontSize: 12.5,
        color: t.ink,
      }}
    >
      <span style={{ color: t.inkDim }}>This position also appears in:</span>
      {matches.map((m) => (
        <button
          key={m.lineId}
          type="button"
          data-testid={`transposition-chip-${m.lineId}`}
          onClick={() => onJump(m.lineId)}
          style={{
            background: t.surface,
            border: `0.5px solid ${t.border}`,
            color: t.brand,
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: fonts.sans,
          }}
        >
          {m.displayName}
        </button>
      ))}
      {truncatedCount > 0 && (
        <span
          data-testid="transposition-more"
          style={{ color: t.inkSoft, fontSize: 11.5 }}
        >
          +{truncatedCount} more
        </span>
      )}
      {onRoulette && matches.length > 1 ? (
        <button
          type="button"
          data-testid="transposition-roulette"
          onClick={onRoulette}
          style={{
            background: t.surface,
            border: `0.5px solid ${t.border}`,
            color: t.brand,
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: fonts.sans,
          }}
        >
          Roulette
        </button>
      ) : null}
      {onDiversion ? (
        <button
          type="button"
          data-testid="transposition-diversion"
          onClick={onDiversion}
          style={{
            background: t.surface,
            border: `0.5px solid ${t.border}`,
            color: t.brand,
            padding: '3px 10px',
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: fonts.sans,
          }}
        >
          Try gambit diversion
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Dismiss transposition banner"
        data-testid="transposition-dismiss"
        onClick={() => setDismissed(true)}
        style={{
          marginLeft: 'auto',
          background: 'transparent',
          border: 'none',
          color: t.inkSoft,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          padding: 2,
        }}
      >
        <X size={14} />
      </button>
    </div>
  );
}
