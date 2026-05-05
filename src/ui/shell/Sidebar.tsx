/**
 * Sidebar — desktop nav rail with collapsible width (240 ↔ 64),
 * mobile drawer fallback.
 *
 * Per Phase 0d.1 + wireframe v1.1 (May 2026): nav = Dashboard / Repertoire /
 * Drill / Progress / Settings. Streak widget + profile dropdown deferred.
 *
 * Collapse semantics:
 *   - Desktop: external `desktopCollapsed` + `onToggleDesktop` props drive
 *     width animation (220ms). Toggle handle pinned at right edge.
 *   - Mobile: `mobileOpen` drives off-canvas drawer (existing behavior, CSS
 *     media-query at 880px). Desktop collapse irrelevant on mobile.
 *
 * Labels hide when collapsed; nav items get `title` tooltips for affordance.
 */

import {
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  Library,
  LineChart,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius, sp } from '../../theme/tokens';

type SidebarProps = {
  mobileOpen: boolean;
  onCloseMobile: () => void;
  desktopCollapsed: boolean;
  onToggleDesktop: () => void;
};

// Drill intentionally omitted — entered ONLY from Repertoire (click an opening).
// /drill is still a registered route (App.tsx) and still appears in TopBar
// when active; it just isn't a top-level destination in the nav.
const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/repertoire', label: 'Repertoire', icon: Library },
  { to: '/progress', label: 'Progress', icon: LineChart },
];

export function Sidebar({
  mobileOpen,
  onCloseMobile,
  desktopCollapsed,
  onToggleDesktop,
}: SidebarProps) {
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
        data-collapsed={desktopCollapsed ? 'true' : 'false'}
        style={{
          width: desktopCollapsed ? 64 : 240,
          flexShrink: 0,
          background: t.surface,
          borderRight: `1px solid ${t.border}`,
          padding: desktopCollapsed ? `${sp[5]}px ${sp[2]}px` : `${sp[5]}px ${sp[3]}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: sp[5],
          transition: 'width 220ms ease, padding 220ms ease',
          position: 'relative',
        }}
      >
        {/* Logo row + mobile close */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: desktopCollapsed ? 'center' : 'space-between',
            padding: desktopCollapsed ? '0' : '0 8px',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
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
                flexShrink: 0,
              }}
            >
              ♞
            </div>
            {!desktopCollapsed && (
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
            )}
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

        {/* Desktop collapse toggle — pinned to right edge */}
        <button
          onClick={onToggleDesktop}
          aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="tabiya-sidebar-toggle"
          style={{
            position: 'absolute',
            top: 26,
            right: -12,
            width: 22,
            height: 22,
            borderRadius: 999,
            background: t.surface,
            border: `1px solid ${t.border}`,
            color: t.inkDim,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            zIndex: 10,
            boxShadow: t.shadow,
          }}
        >
          {desktopCollapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!desktopCollapsed && (
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
          )}
          {navItems.map((it) => (
            <NavItem
              key={it.to}
              to={it.to}
              label={it.label}
              icon={it.icon}
              onClick={onCloseMobile}
              collapsed={desktopCollapsed}
            />
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        <NavItem
          to="/settings"
          label="Settings"
          icon={Settings}
          onClick={onCloseMobile}
          collapsed={desktopCollapsed}
        />
      </aside>
    </>
  );
}

function NavItem({
  to,
  label,
  icon: Icon,
  onClick,
  collapsed,
}: {
  to: string;
  label: string;
  icon: typeof Menu;
  onClick: () => void;
  collapsed: boolean;
}) {
  const t = useTokens();
  return (
    <NavLink
      to={to}
      end={to === '/'}
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={({ isActive }) => ({
        textDecoration: 'none',
        background: isActive ? t.brandSoft : 'transparent',
        color: isActive ? t.brand : t.ink,
        borderRadius: radius.chip,
        padding: collapsed ? '10px' : '9px 10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start',
        gap: 10,
        fontFamily: fonts.sans,
        fontSize: 14,
        fontWeight: 500,
      })}
    >
      {({ isActive }) => (
        <>
          <Icon size={17} strokeWidth={isActive ? 2.4 : 2} />
          {!collapsed && <span style={{ flex: 1 }}>{label}</span>}
        </>
      )}
    </NavLink>
  );
}
