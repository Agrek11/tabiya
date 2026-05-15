/**
 * AppShell — column layout matching v1 preview:
 *
 *   ┌─────────── TopBar (sticky 68px) ───────────┐
 *   │ PageSidebar (220px) │ main content (flex)  │
 *   └─────────────────────┴──────────────────────┘
 *
 * Source of truth: specs/wireframes/tabiya-v1-preview.html.
 *
 * Mobile (≤880px, see src/index.css): PageSidebar is hidden via the
 * `.tabiya-page-sidebar` rule. TopBar stays. A future pass can add a drawer.
 */

import { type PropsWithChildren } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { PageSidebar } from './PageSidebar';
import { TopBar } from './TopBar';

export function AppShell({ children }: PropsWithChildren) {
  const t = useTokens();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        background: t.bg,
        color: t.ink,
      }}
    >
      <TopBar />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <PageSidebar />
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0,
            overflowX: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
