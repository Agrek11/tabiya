/**
 * HeatmapTabs — three-tab shell over the per-event heatmap renderers.
 *
 * Active tab persists in `localStorage['tabiya.heatmapTab']`. Tab order is
 * fixed (R3.1): daily activity, per-opening accuracy, hour of day. The panel
 * (tab bar + body) always renders, even when `events.length === 0` — child
 * renderers handle their own empty captions (R3.5).
 *
 * Heatmap cells use `heatmap-cell` classnames distinct from any board-square
 * highlight primitive (Article 15, design §3.6).
 */

import { useEffect, useState } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts, radius } from '../../theme/tokens';
import { Card } from '../../ui/primitives/Card';
import { useEventsContext } from '../../state/EventsContext';
import { DailyActivityGrid } from './heatmap/DailyActivityGrid';
import { OpeningAccuracyGrid } from './heatmap/OpeningAccuracyGrid';
import { HourOfDayRow } from './heatmap/HourOfDayRow';
import type { SessionEvent } from '../../types/events';

type TabId = 'daily' | 'accuracy' | 'hour';
const STORAGE_KEY = 'tabiya.heatmapTab';
const DEFAULT_TAB: TabId = 'daily';

const TABS: ReadonlyArray<{ id: TabId; label: string; emptyCaption: string }> = [
  {
    id: 'daily',
    label: 'Daily activity',
    emptyCaption: 'Drill a line to start seeing your daily activity here.',
  },
  {
    id: 'accuracy',
    label: 'Per-opening accuracy',
    emptyCaption:
      'Drill at least 5 sessions on a line to start seeing per-opening accuracy here.',
  },
  {
    id: 'hour',
    label: 'Hour of day',
    emptyCaption: 'Drill a line to start seeing your hourly rhythm.',
  },
];

function readStoredTab(): TabId {
  if (typeof window === 'undefined') return DEFAULT_TAB;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === 'daily' || raw === 'accuracy' || raw === 'hour') return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_TAB;
}

function writeStoredTab(tab: TabId): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, tab);
  } catch {
    /* ignore quota / private mode */
  }
}

export function HeatmapTabs() {
  const t = useTokens();
  const [tab, setTab] = useState<TabId>(readStoredTab);
  const { events } = useEventsContext();

  useEffect(() => {
    writeStoredTab(tab);
  }, [tab]);

  const active = TABS.find((x) => x.id === tab) ?? TABS[0]!;
  const isEmpty = events.length === 0;

  return (
    <Card padding={16}>
      <div
        role="tablist"
        aria-label="Heatmap views"
        style={{
          display: 'flex',
          gap: 4,
          borderBottom: `1px solid ${t.border}`,
          marginBottom: 14,
        }}
      >
        {TABS.map((opt) => {
          const isActive = opt.id === tab;
          return (
            <button
              key={opt.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setTab(opt.id)}
              style={{
                background: 'transparent',
                border: 'none',
                padding: '8px 12px',
                fontFamily: fonts.sans,
                fontSize: 13,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? t.ink : t.inkDim,
                cursor: 'pointer',
                borderBottom: `2px solid ${isActive ? t.brand : 'transparent'}`,
                marginBottom: -1,
                borderRadius: `${radius.chip} ${radius.chip} 0 0`,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">
        {isEmpty ? (
          <div
            style={{
              fontSize: 13,
              color: t.inkSoft,
              fontFamily: fonts.sans,
              padding: '12px 0',
            }}
            data-testid="heatmap-empty"
          >
            {active.emptyCaption}
          </div>
        ) : (
          renderTab(tab, events)
        )}
      </div>
    </Card>
  );
}

function renderTab(tab: TabId, events: SessionEvent[]) {
  if (tab === 'daily') return <DailyActivityGrid events={events} />;
  if (tab === 'accuracy') return <OpeningAccuracyGrid events={events} />;
  return <HourOfDayRow events={events} />;
}
