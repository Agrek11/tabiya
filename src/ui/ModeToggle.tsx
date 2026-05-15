/**
 * ModeToggle — Phase 1b two-state segmented control [Drill | Explain].
 *
 * Pill-styled to match the existing v1.3 DrillPage header pickers. Keyboard
 * accessible — arrow keys cycle, Enter/Space commits. Role=tablist on the
 * outer element, role=tab on each option.
 *
 * Visibility (R1): caller decides when to render. ModeToggle just renders
 * the pill. Caller passes `disabled` while content is loading.
 *
 * Article 14 — strict TS.
 */

import { useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import type { ExplainModeChoice } from '../hooks/useLinePrefMode';

export type ModeToggleProps = {
  value: ExplainModeChoice;
  onChange(mode: ExplainModeChoice): void;
  disabled?: boolean;
};

const OPTIONS: ReadonlyArray<{ id: ExplainModeChoice; label: string; Icon: typeof BookOpen }> = [
  { id: 'drill', label: 'Drill', Icon: BookOpen },
  { id: 'explain', label: 'Explain', Icon: Sparkles },
];

export function ModeToggle({ value, onChange, disabled = false }: ModeToggleProps): React.JSX.Element {
  const t = useTokens();
  const buttonRefs = useRef<Map<ExplainModeChoice, HTMLButtonElement | null>>(new Map());

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const idx = OPTIONS.findIndex((o) => o.id === value);
    const nextIdx = e.key === 'ArrowLeft' ? (idx - 1 + OPTIONS.length) % OPTIONS.length : (idx + 1) % OPTIONS.length;
    const next = OPTIONS[nextIdx]?.id ?? value;
    onChange(next);
    const btn = buttonRefs.current.get(next);
    btn?.focus();
  };

  const outerStyle: CSSProperties = {
    display: 'inline-flex',
    background: t.surfaceAlt,
    border: `1px solid ${t.border}`,
    borderRadius: 999,
    padding: 3,
    opacity: disabled ? 0.55 : 1,
    pointerEvents: disabled ? 'none' : 'auto',
  };

  return (
    <div
      role="tablist"
      aria-label="Drill or Explain mode"
      onKeyDown={onKeyDown}
      style={outerStyle}
      data-testid="mode-toggle"
    >
      {OPTIONS.map((opt) => {
        const isActive = opt.id === value;
        const Icon = opt.Icon;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              buttonRefs.current.set(opt.id, el);
            }}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            data-testid={`mode-toggle-${opt.id}`}
            onClick={() => onChange(opt.id)}
            disabled={disabled}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: isActive ? t.surface : 'transparent',
              border: 'none',
              borderRadius: 999,
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontFamily: fonts.sans,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              color: isActive ? t.brand : t.ink,
              boxShadow: isActive ? t.shadow : 'none',
              transition: 'background 120ms ease, color 120ms ease',
            }}
          >
            <Icon size={14} strokeWidth={isActive ? 2.4 : 2} />
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
