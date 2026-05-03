/**
 * TopBar — sticky 56px header with breadcrumb (left) and theme toggle (right).
 *
 * Phase 0d.1 trims v1's search box + notifications bell — they re-appear
 * once their data sources land (catalog growth, review-due alerts).
 */

import { Menu, Moon, Sun } from 'lucide-react';
import { useTheme, useTokens } from '../../theme/ThemeContext';
import { fonts, radius, sp } from '../../theme/tokens';

type TopBarProps = {
  breadcrumb?: string;
  title?: string;
  onMenuClick: () => void;
};

export function TopBar({ breadcrumb, title, onMenuClick }: TopBarProps) {
  const t = useTokens();
  const { scheme, toggle } = useTheme();
  return (
    <div
      style={{
        height: 56,
        borderBottom: `1px solid ${t.border}`,
        background: t.surface,
        display: 'flex',
        alignItems: 'center',
        padding: `0 ${sp[6]}px`,
        gap: sp[3],
        position: 'sticky',
        top: 0,
        zIndex: 20,
      }}
    >
      <button
        onClick={onMenuClick}
        className="tabiya-topbar-menu"
        aria-label="Open menu"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: t.inkDim,
          padding: sp[2],
          display: 'none',
        }}
      >
        <Menu size={20} />
      </button>

      <div style={{ flex: 1, fontFamily: fonts.sans }}>
        {breadcrumb && (
          <div style={{ fontSize: 12, color: t.inkDim, marginBottom: 1 }}>{breadcrumb}</div>
        )}
        {title && <div style={{ fontSize: 15, fontWeight: 600, color: t.ink }}>{title}</div>}
      </div>

      <button
        onClick={toggle}
        aria-label="Toggle theme"
        style={{
          width: 36,
          height: 36,
          background: t.surfaceAlt,
          border: `1px solid ${t.border}`,
          borderRadius: radius.chip,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          color: t.inkDim,
        }}
      >
        {scheme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </div>
  );
}
