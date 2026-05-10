/**
 * AppShell — composes Sidebar + TopBar around the active route's content.
 *
 * Layout grid + mobile drawer state + desktop sidebar collapse state.
 *
 * Drill route intentionally suppresses TopBar title/breadcrumb (wireframe v1.1
 * — drill page owns its own header chrome via line/mode dropdowns).
 */

import { useState, type PropsWithChildren } from 'react';
import { useLocation } from 'react-router-dom';
import { useTokens } from '../../theme/ThemeContext';
import { sp } from '../../theme/tokens';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { useSidebarCollapsed } from './use-sidebar-collapsed';

const PATH_TITLES: Record<string, { title: string; breadcrumb?: string }> = {
  '/': { title: 'Dashboard' },
  '/repertoire': { title: 'Repertoire' },
  '/repertoire/gambits': { title: 'Gambits', breadcrumb: 'Repertoire' },
  '/drill': { title: '', breadcrumb: '' },
  '/progress': { title: 'Progress' },
  '/settings': { title: 'Settings' },
};

export function AppShell({ children }: PropsWithChildren) {
  const t = useTokens();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useSidebarCollapsed();
  const location = useLocation();
  const meta = PATH_TITLES[location.pathname] ?? { title: '' };

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: t.bg,
        color: t.ink,
      }}
    >
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        desktopCollapsed={desktopCollapsed}
        onToggleDesktop={() => setDesktopCollapsed(!desktopCollapsed)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <TopBar
          breadcrumb={meta.breadcrumb}
          title={meta.title}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main
          style={{
            flex: 1,
            padding: `${sp[6]}px ${sp[7]}px`,
            maxWidth: 1280,
            width: '100%',
            margin: '0 auto',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
