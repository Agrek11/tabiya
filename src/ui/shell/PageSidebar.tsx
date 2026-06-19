/**
 * PageSidebar — 220px context-aware sidebar (preview `.page-sidebar`).
 *
 * Renders per-route navigation content. Route resolution = first matching
 * prefix in PAGE_SIDEBAR_CONTENT, falling back to "/" (home).
 *
 * Items are a static navigational index per route — plain, non-interactive
 * labels (no onClick wired yet, so they render with a default cursor, not a
 * pointer). No fabricated stats and no fictional "Current Weakness" card: the
 * only data-backed entry is the home "Due Drills" badge. Wiring items to real
 * filters/views (e.g. ?view=) is a follow-up.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { useSRS } from '../../hooks/useSRS';
import { getRepository } from '../../storage';
import type { Family, FamilyCategory } from '../../storage/types';

// Consolidated category buckets for the Repertoire sidebar — far fewer entries
// than the 30 raw families. Gambits get their own bucket; families with no
// known category fall under "Others". Search handles precise per-opening jumps.
const CATEGORY_ORDER: FamilyCategory[] = [
  'open',
  'semi-open',
  'closed',
  'indian',
  'flank',
  'gambit',
  'uncategorized',
];
const CATEGORY_SIDEBAR_LABELS: Record<FamilyCategory, string> = {
  open: 'Open Games',
  'semi-open': 'Semi-Open',
  closed: 'Closed',
  indian: 'Indian',
  flank: 'Flank',
  gambit: 'Gambits',
  uncategorized: 'Others',
};

type Item = {
  label: string;
  badge?: string | number;
  /** Scrolls to this element id on the current page. */
  anchor?: string;
  /** Navigates to this route (query params honored by the target page). */
  to?: string;
};

type Section = {
  title: string;
  items: Item[];
};

type PageDef = {
  sections: Section[];
};

/**
 * Sidebar definitions per route prefix. Order matters — `routeFor` picks the
 * first match. Always include "/" last as fallback.
 */
function buildDefs(dueCount: number): Record<string, PageDef> {
  // Every item does something real: `to` navigates (query params honored by the
  // target page's filters), `anchor` scrolls to a section on the current page.
  // No fabricated stats, no fictional weakness cards.
  return {
    '/drill': {
      sections: [
        {
          title: 'Jump to',
          items: [
            { label: 'Due queue', badge: dueCount, to: '/drill?queue=due' },
            { label: 'Spanish', to: '/drill?family=spanish' },
            { label: 'Italian', to: '/drill?family=italian' },
            { label: 'Sicilian', to: '/drill?family=sicilian' },
            { label: 'French', to: '/drill?family=french' },
            { label: 'Caro-Kann', to: '/drill?family=caro-kann' },
          ],
        },
      ],
    },
    '/settings': {
      sections: [
        {
          title: 'Sections',
          items: [
            { label: 'Appearance', anchor: 'settings-appearance' },
            { label: 'Sound', anchor: 'settings-sound' },
            { label: 'Engine', anchor: 'settings-engine' },
            { label: 'AI Coach', anchor: 'settings-ai' },
            { label: 'Lichess', anchor: 'settings-lichess' },
            { label: 'Chess.com', anchor: 'settings-chesscom' },
            { label: 'Repertoire Preset', anchor: 'settings-preset' },
            { label: 'Danger Zone', anchor: 'settings-danger' },
          ],
        },
      ],
    },
  };
}

// Repertoire filter is catalog-driven + consolidated into categories (only the
// categories actually present in the repertoire are shown). Each seeds the
// page's ?category filter; "All openings" clears it.
function buildRepertoireDef(families: Family[]): PageDef {
  const present = new Set(families.map((f) => f.category));
  const cats = CATEGORY_ORDER.filter((c) => present.has(c));
  return {
    sections: [
      {
        title: 'Filter by category',
        items: [
          { label: 'All openings', to: '/repertoire' },
          ...cats.map((c) => ({
            label: CATEGORY_SIDEBAR_LABELS[c],
            to: `/repertoire?category=${c}`,
          })),
        ],
      },
    ],
  };
}

// Sidebar shows ONLY where it navigates/filters: Repertoire (family filter),
// Drill (family/queue jumps), Settings (section anchors). Single-screen pages
// (Home, Insights, Games, Coach) get no sidebar — `routeFor` returns null and
// the aside is not rendered, so `main` takes the full width.
function routeFor(pathname: string, defs: Record<string, PageDef>): PageDef | null {
  const orderedKeys = ['/drill', '/settings'];
  for (const key of orderedKeys) {
    const def = defs[key];
    if (def && (pathname === key || pathname.startsWith(key + '/'))) {
      return def;
    }
  }
  return null;
}

export function PageSidebar() {
  const t = useTokens();
  const location = useLocation();
  const { dueLineIds } = useSRS();
  const [families, setFamilies] = useState<Family[]>([]);

  const onRepertoire =
    location.pathname === '/repertoire' || location.pathname.startsWith('/repertoire/');

  // Load the catalog's families once (drives the Repertoire family filter).
  useEffect(() => {
    let cancelled = false;
    void getRepository()
      .listFamilies()
      .then((f) => {
        if (!cancelled) setFamilies(f);
      })
      .catch(() => {
        /* sidebar filter degrades to empty — search still works */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const def = onRepertoire
    ? buildRepertoireDef(families)
    : routeFor(location.pathname, buildDefs(dueLineIds.length));
  if (!def) return null;

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
              <SidebarItem
                key={item.label}
                item={item}
                active={item.to !== undefined && location.pathname + location.search === item.to}
              />
            ))}
          </div>
        </div>
      ))}
    </aside>
  );
}

function SidebarItem({ item, active }: { item: Item; active: boolean }) {
  const t = useTokens();
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const clickable = item.anchor !== undefined || item.to !== undefined;
  const activate = (): void => {
    if (item.to !== undefined) {
      navigate(item.to);
    } else if (item.anchor !== undefined) {
      document.getElementById(item.anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const hoverHi = hovered && clickable && !active;
  return (
    <div
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? activate : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                activate();
              }
            }
          : undefined
      }
      style={{
        background: active ? t.brandSoft : hoverHi ? t.surfaceAlt : 'transparent',
        border: `0.5px solid ${active ? t.brandSoftBorder : 'transparent'}`,
        color: active || hoverHi ? t.brand : t.ink,
        padding: '9px 12px',
        borderRadius: 11,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        cursor: clickable ? 'pointer' : 'default',
        textAlign: 'left',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 120ms ease, color 120ms ease',
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
