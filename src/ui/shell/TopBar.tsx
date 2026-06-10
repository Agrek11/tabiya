/**
 * TopBar — 68px sticky header matching v1 preview (`.topbar`).
 *
 * Layout (3 columns):
 *   - Left:   brand mark (30px ♞ square) + "tabiya" wordmark + tagline
 *   - Center: 5 NavLinks (Home / Repertoire / Insights / Games / Coach)
 *   - Right:  gear → /settings, theme toggle, "Continue Training" CTA with
 *             live `N due` badge driven by useSRS().
 *
 * Source of truth: specs/wireframes/tabiya-v1-preview.html `.topbar` block +
 * the matching `<header class="topbar">` markup.
 */

import { Moon, Play, Settings as SettingsIcon, Sun } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme, useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { useSRS } from '../../hooks/useSRS';

type NavSpec = { to: string; label: string; end?: boolean };

const NAV: NavSpec[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/repertoire', label: 'Repertoire' },
  { to: '/insights', label: 'Insights' },
  { to: '/games', label: 'Games' },
  { to: '/coach', label: 'Coach' },
];

export function TopBar() {
  const t = useTokens();
  const { scheme, toggle } = useTheme();
  const navigate = useNavigate();
  const { dueLineIds } = useSRS();
  const dueCount = dueLineIds.length;

  return (
    <header
      style={{
        height: 68,
        borderBottom: `0.5px solid ${t.border}`,
        background: t.surface,
        display: 'flex',
        alignItems: 'center',
        padding: '0 28px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        fontFamily: fonts.sans,
      }}
    >
      {/* LEFT — brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: t.brand,
            color: t.brandInk,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
          }}
          aria-hidden
        >
          ♞
        </div>
        <div>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: '-0.02em',
              lineHeight: 1,
            }}
          >
            tabiya
          </div>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: t.inkSoft,
              marginTop: 3,
            }}
          >
            Attention-guided chess learning
          </div>
        </div>
      </div>

      {/* CENTER — nav */}
      <nav
        style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            style={({ isActive }) => ({
              textDecoration: 'none',
              background: isActive ? t.brandSoft : 'transparent',
              border: `0.5px solid ${isActive ? t.brandSoftBorder : 'transparent'}`,
              color: isActive ? t.brand : t.inkDim,
              padding: '8px 14px',
              borderRadius: 11,
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              fontFamily: fonts.sans,
              cursor: 'pointer',
              transition: 'all 150ms ease',
              display: 'inline-flex',
              alignItems: 'center',
            })}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* RIGHT — actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => navigate('/settings')}
          aria-label="Settings"
          title="Settings"
          style={iconBtnStyle(t)}
        >
          <SettingsIcon size={16} />
        </button>
        <button
          onClick={toggle}
          aria-label="Toggle theme"
          title="Toggle theme"
          style={iconBtnStyle(t)}
        >
          {scheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button
          onClick={() => navigate('/drill?queue=due')}
          aria-label="Continue training"
          style={{
            background: t.brand,
            color: t.brandInk,
            border: 'none',
            padding: '9px 16px',
            borderRadius: 11,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: fonts.sans,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            transition: 'background 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = t.brandHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = t.brand;
          }}
        >
          <Play size={14} fill="currentColor" />
          Continue Training
          <span
            data-testid="topbar-due-badge"
            style={{
              background: 'rgba(0,0,0,0.18)',
              padding: '1px 6px',
              borderRadius: 999,
              fontSize: 10.5,
              fontWeight: 700,
            }}
          >
            {dueCount} due
          </span>
        </button>
      </div>
    </header>
  );
}

function iconBtnStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: 'transparent',
    border: `0.5px solid ${t.border}`,
    color: t.inkDim,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 150ms ease',
    padding: 0,
  };
}
