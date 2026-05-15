/**
 * DrillModeToggleHeader — Phase 2b drill-page header chip (R7).
 *
 * Tiny presentational toggle button for the Pattern Viz key-square overlay.
 * Lives next to the Mode pill in the drill toolbar. Hidden by the caller
 * when the active opening has no `key_squares` data (R7.5 graceful
 * degrade). The visibility decision + persistence live in
 * `useKeySquareOverlay`; this component just renders.
 *
 * Article 14 (type discipline): strict, no `any`.
 */

import { Eye, EyeOff } from 'lucide-react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

export interface DrillModeToggleHeaderProps {
  /** Current persisted drill preference (independent of Explain force-on). */
  active: boolean;
  /** True when Explain Mode is forcing the overlay on (R7.3). */
  forcedByExplain?: boolean;
  onClick(): void;
}

export function DrillModeToggleHeader({
  active,
  forcedByExplain = false,
  onClick,
}: DrillModeToggleHeaderProps): React.JSX.Element {
  const t = useTokens();
  const showActive = active || forcedByExplain;
  return (
    <button
      type="button"
      data-testid="key-square-toggle"
      aria-pressed={showActive}
      aria-label={
        forcedByExplain
          ? 'Key squares overlay (forced on by Explain Mode)'
          : showActive
            ? 'Hide key squares overlay'
            : 'Show key squares overlay'
      }
      onClick={onClick}
      disabled={forcedByExplain}
      title={
        forcedByExplain
          ? 'Key squares are on while Explain Mode is active'
          : undefined
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 11px',
        borderRadius: 999,
        border: `0.5px solid ${showActive ? t.brandSoftBorder : t.border}`,
        background: showActive ? t.brandSoft : t.surface,
        color: showActive ? t.brand : t.inkDim,
        fontFamily: fonts.sans,
        fontSize: 12,
        fontWeight: 600,
        cursor: forcedByExplain ? 'not-allowed' : 'pointer',
        opacity: forcedByExplain ? 0.85 : 1,
      }}
    >
      {showActive ? <Eye size={13} /> : <EyeOff size={13} />}
      <span>Key squares: {showActive ? 'on' : 'off'}</span>
    </button>
  );
}
