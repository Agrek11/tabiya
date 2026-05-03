/**
 * Sidebar — 240px nav rail, logo + nav items + Settings cog footer.
 *
 * Per Phase 0d.1: nav = Dashboard / Repertoire / Drill / Progress / Settings.
 * Streak widget + profile dropdown DEFERRED until SRS / Lichess sync land
 * (rendered as light placeholder for now to preserve v1 layout shape).
 */

import { Library, LayoutDashboard, LineChart, Menu, Settings, Target, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius, sp } from '../../theme/tokens';

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
};

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/repertoire', label: 'Repertoire', icon: Library },
  { to: '/drill', label: 'Drill', icon: Target },
  { to: '/progress', label: 'Progress', icon: LineChart },
];

export function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const t = useTokens();

  return (
    <>
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 99,
          }}
        />
      )}
      <aside
        className={`tabiya-sidebar${mobileOpen ? ' open' : ''}`}
        style={{
          width: 240,
          flexShrink: 0,
          background: t.surface,
          borderRight: `1px solid ${t.border}`,
          padding: `${sp[5]}px ${sp[3]}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: sp[5],
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                background: t.brand,
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 19,
                color: '#FFF',
              }}
            >
              ♞
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: 17,
                letterSpacing: -0.3,
                color: t.ink,
                fontFamily: fonts.sans,
              }}
            >
              tabiya
            </div>
          </div>
          <button
            onClick={onCloseMobile}
            className="tabiya-sidebar-close"
            aria-label="Close menu"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: t.inkDim,
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: t.inkSoft,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              padding: '0 10px',
              marginBottom: 6,
              fontFamily: fonts.sans,
            }}
          >
            Workspace
          </div>
          {navItems.map((it) => (
            <NavItem
              key={it.to}
              to={it.to}
              label={it.label}
              icon={it.icon}
              onClick={onCloseMobile}
            />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <NavItem to="/settings" label="Settings" icon={Settings} onClick={onCloseMobile} />
      </aside>
    </>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  onClick,
}: {
  to: string;
  label: string;
  icon: typeof Menu;
  onClick: () => void;
}) {
  const t = useTokens();
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      style={({ isActive }) => ({
        textDecoration: 'none',
        background: isActive ? t.brandSoft : 'transparent',
        color: isActive ? t.brand : t.ink,
        borderRadius: radius.chip,
        padding: '9px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: fonts.sans,
        fontSize: 14,
        fontWeight: 500,
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
          <span style={{ flex: 1 }}>{label}</span>
        </>
      )}
    </NavLink>
  );
}
