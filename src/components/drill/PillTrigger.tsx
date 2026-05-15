/**
 * PillTrigger — pill-shaped button used as a SlickMenu trigger in the drill
 * toolbar.
 *
 * v1 preview `.pill-btn`: surface bg, 0.5px border, 12px radius, 8/14 padding,
 * 12.5px font. `prominent` swaps to a slightly bolder treatment for the
 * Opening pill, which leads the toolbar.
 */

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';

type PillTriggerProps = {
  label: string;
  open: boolean;
  onClick: () => void;
  ariaLabel: string;
  prominent?: boolean;
  accent?: ReactNode;
  disabled?: boolean;
};

export function PillTrigger({
  label,
  open,
  onClick,
  ariaLabel,
  prominent = false,
  accent,
  disabled = false,
}: PillTriggerProps) {
  const t = useTokens();
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={open}
      disabled={disabled}
      style={{
        background: open ? t.surfaceAlt : t.surface,
        border: `0.5px solid ${open ? t.borderStrong : t.border}`,
        color: t.ink,
        padding: '8px 14px',
        borderRadius: 12,
        fontSize: prominent ? 13 : 12.5,
        fontWeight: prominent ? 600 : 500,
        fontFamily: fonts.sans,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        transition: 'background 120ms ease, border-color 120ms ease',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {accent}
      <span>{label}</span>
      <ChevronDown
        size={13}
        strokeWidth={2.2}
        style={{
          transition: 'transform 150ms',
          transform: open ? 'rotate(180deg)' : 'rotate(0)',
          color: t.inkSoft,
        }}
      />
    </button>
  );
}
