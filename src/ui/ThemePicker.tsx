/**
 * ThemePicker — minimal segmented control for board theme selection.
 *
 * Visual customization (Req: user wants control over board look). Three
 * presets, persisted via the theme module. No design system, no dependencies.
 */

import type { CSSProperties } from 'react';
import { THEMES, type BoardTheme } from '../theme/themes';

type ThemePickerProps = {
  current: BoardTheme;
  onChange: (theme: BoardTheme) => void;
};

const containerStyle: CSSProperties = {
  display: 'flex',
  gap: '6px',
  padding: '4px',
  borderRadius: '6px',
  background: '#eaeaea',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const baseButton: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 10px',
  border: 'none',
  borderRadius: '4px',
  background: 'transparent',
  fontSize: '12px',
  color: '#444',
  cursor: 'pointer',
};

const activeButton: CSSProperties = {
  ...baseButton,
  background: '#fff',
  fontWeight: 600,
  boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
};

const swatchStyle = (light: string, dark: string): CSSProperties => ({
  width: '14px',
  height: '14px',
  borderRadius: '2px',
  background: `linear-gradient(135deg, ${light} 0% 50%, ${dark} 50% 100%)`,
  border: '1px solid rgba(0,0,0,0.15)',
});

export function ThemePicker({ current, onChange }: ThemePickerProps) {
  return (
    <div style={containerStyle} role="radiogroup" aria-label="Board theme">
      {THEMES.map((t) => {
        const active = t.id === current.id;
        return (
          <button
            key={t.id}
            role="radio"
            aria-checked={active}
            style={active ? activeButton : baseButton}
            onClick={() => onChange(t)}
          >
            <span style={swatchStyle(t.light, t.dark)} />
            {t.name}
          </button>
        );
      })}
    </div>
  );
}
