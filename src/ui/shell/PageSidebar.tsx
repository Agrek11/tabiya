/**
 * PageSidebar — 220px context-aware sidebar (preview `.page-sidebar`).
 *
 * Renders per-route navigation content. Route resolution = first matching
 * prefix in PAGE_SIDEBAR_CONTENT, falling back to "/" (home).
 *
 * Source of truth: specs/wireframes/tabiya-v1-preview.html `SIDEBAR_CONTENT`
 * mapping. Item copy is hardcoded to match the preview verbatim. Wiring item
 * onClick to real filters/views is a follow-up — for now items are visual
 * placeholders. Active state is currently static-per-section ("first item")
 * to mirror the preview; a future pass will key off URL state (e.g. ?view=).
 *
 * "Current Weakness" card text is hardcoded placeholder copy. Wire from
 * Phase 1.5 events in a follow-up.
 */

import { useLocation } from 'react-router-dom';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { useSRS } from '../../hooks/useSRS';

type Item = {
  label: string;
  badge?: string | number;
  active?: boolean;
};

type Section = {
  title: string;
  items: Item[];
};

type PageDef = {
  sections: Section[];
  weakness?: string; // shows the Current Weakness card with this copy
};

/**
 * Sidebar definitions per route prefix. Order matters — `routeFor` picks the
 * first match. Always include "/" last as fallback.
 */
function buildDefs(dueCount: number): Record<string, PageDef> {
  return {
    '/repertoire': {
      sections: [
        {
          title: 'Families',
          items: [
            { label: 'Open Games', active: true },
            { label: 'Sicilian' },
            { label: 'French' },
            { label: 'Caro-Kann' },
            { label: 'Indian' },
          ],
        },
      ],
      weakness: 'Kingside attacks against Sicilian structures.',
    },
    '/drill': {
      sections: [
        {
          title: 'Opening Families',
          items: [
            { label: 'Open Games', active: true },
            { label: 'Sicilian Defense' },
            { label: 'French Defense' },
            { label: 'Caro-Kann' },
            { label: 'Indian Defenses' },
          ],
        },
        {
          title: 'Quick Filters',
          items: [
            { label: 'Due Today' },
            { label: 'Weak Lines' },
            { label: 'Recently Missed' },
            { label: 'Mastered' },
          ],
        },
      ],
      weakness: 'Kingside pawn storms in Sicilian structures.',
    },
    '/insights': {
      sections: [
        {
          title: 'View',
          items: [
            { label: 'Overview', active: true },
            { label: 'By Opening' },
            { label: 'Recurring Mistakes' },
            { label: 'Time of Day' },
          ],
        },
      ],
    },
    '/games': {
      sections: [
        {
          title: 'Sources',
          items: [
            { label: 'All Platforms', active: true },
            { label: 'Lichess only' },
            { label: 'Chess.com only' },
          ],
        },
        {
          title: 'Lens',
          items: [
            { label: 'Recent' },
            { label: 'Out of Book' },
            { label: 'Losses' },
          ],
        },
      ],
    },
    '/coach': {
      sections: [
        {
          title: 'Sessions',
          items: [{ label: 'No chats yet', active: true }],
        },
      ],
    },
    '/settings': {
      sections: [
        {
          title: 'Sections',
          items: [
            { label: 'Appearance', active: true },
            { label: 'Sound' },
            { label: 'Repertoire Preset' },
            { label: 'Danger Zone' },
            { label: 'About' },
          ],
        },
      ],
    },
    '/': {
      sections: [
        {
          title: 'Today',
          items: [
            {
              label: `${dueCount} Due Drills`,
              badge: dueCount,
              active: true,
            },
            { label: '2 Weak Lines' },
            { label: '82% Retention' },
          ],
        },
      ],
      weakness: 'Kingside attacks against Sicilian structures.',
    },
  };
}

function routeFor(pathname: string, defs: Record<string, PageDef>): PageDef {
  // Longest-prefix match, but explicit list (drill before repertoire etc.).
  const orderedKeys = ['/repertoire', '/drill', '/insights', '/games', '/coach', '/settings'];
  for (const key of orderedKeys) {
    if (pathname === key || pathname.startsWith(key + '/')) {
      return defs[key];
    }
  }
  return defs['/'];
}

export function PageSidebar(): JSX.Element {
  const t = useTokens();
  const location = useLocation();
  const { dueLineIds } = useSRS();
  const def = routeFor(location.pathname, buildDefs(dueLineIds.length));

  return (
    <aside
      className="tabiya-page-sidebar"
      style={{
        width: 220,
        flexShrink: 0,
        background: t.surface,
        borderRight: `0.5px solid ${t.border}`,
        padding: '22px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        overflowY: 'auto',
        fontFamily: fonts.sans,
      }}
    >
      {def.sections.map((section) => (
        <div key={section.title}>
          <div
            style={{
              fontSize: 10.5,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: t.inkSoft,
              fontWeight: 600,
              marginBottom: 10,
              padding: '0 4px',
            }}
          >
            {section.title}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {section.items.map((item) => (
              <SidebarItem key={item.label} item={item} />
            ))}
          </div>
        </div>
      ))}

      {def.weakness && (
        <div
          style={{
            marginTop: 'auto',
            background: t.brandSoft,
            border: `0.5px solid ${t.brandSoftBorder}`,
            borderRadius: 14,
            padding: 14,
          }}
        >
          <div
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.18em',
              color: t.brand,
              fontWeight: 600,
              marginBottom: 7,
            }}
          >
            Current Weakness
          </div>
          <p style={{ fontSize: 12, color: t.ink, lineHeight: 1.55, margin: 0 }}>
            {def.weakness}
          </p>
        </div>
      )}
    </aside>
  );
}

function SidebarItem({ item }: { item: Item }): JSX.Element {
  const t = useTokens();
  const active = !!item.active;
  return (
    <div
      style={{
        background: active ? t.brandSoft : 'transparent',
        border: `0.5px solid ${active ? t.brandSoftBorder : 'transparent'}`,
        color: active ? t.brand : t.ink,
        padding: '9px 12px',
        borderRadius: 11,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        cursor: 'pointer',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'all 150ms ease',
      }}
    >
      <span>{item.label}</span>
      {item.badge !== undefined && item.badge !== 0 && (
        <span
          style={{
            background: t.success,
            color: '#fff',
            fontSize: 10,
            fontWeight: 600,
            padding: '2px 7px',
            borderRadius: 999,
          }}
        >
          {item.badge}
        </span>
      )}
    </div>
  );
}
