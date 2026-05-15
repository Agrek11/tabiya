/**
 * InsightsPage — analytics surface (Phase 1.5 / 2).
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="insights"`.
 *
 * Real data wiring waits on full event history (Phase 1.5 events ship Streak +
 * Accuracy now; the rest stays in pending state with an em-dash + caption). The
 * layout exists today so the route is in place and the design is locked.
 */

import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { Insight, InsightStack } from '../ui/primitives/Insight';
import { StatCard } from '../ui/primitives/StatCard';
import { EventsContextProvider } from '../state/EventsContext';
import { useAccuracy } from '../hooks/useAccuracy';
import { RetentionTrendChart } from '../components/insights/RetentionTrendChart';
import { PerformanceHeatmap } from '../components/insights/PerformanceHeatmap';

export function InsightsPage() {
  return (
    <EventsContextProvider>
      <InsightsBody />
    </EventsContextProvider>
  );
}

function InsightsBody() {
  const t = useTokens();
  const accuracy = useAccuracy();
  const accAllTime = accuracy.allTime.accuracy;
  const accuracyValue = accAllTime !== null ? `${Math.round(accAllTime * 100)}%` : null;

  return (
    <PageBody>
      {/* Filter row — title left, filters right (matches v1 .filter-row) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          marginBottom: 24,
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 34,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: '-0.04em',
              fontFamily: fonts.sans,
            }}
          >
            Insights
          </h2>
          <p
            style={{
              margin: '6px 0 0',
              color: t.inkDim,
              fontSize: 13.5,
              fontFamily: fonts.sans,
            }}
          >
            Performance patterns, weaknesses, retention, and learning analytics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <SelectPill
            ariaLabel="Time period"
            options={['Last 30 Days', 'Last 7 Days', 'All Time']}
          />
          <SelectPill
            ariaLabel="Opening filter"
            options={['All Openings', 'Open Games', 'Sicilian']}
          />
        </div>
      </div>

      {/* KPI grid — 4 columns */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <StatCard
          title="Retention"
          tone="brand"
          value=""
          pending
          caption="Wire pending Phase 2 event history"
        />
        <StatCard
          title="Accuracy"
          tone="success"
          value={accuracyValue ?? ''}
          pending={accuracyValue === null}
          caption={
            accuracyValue === null
              ? 'No data yet'
              : accuracy.deltaPp !== null
                ? `${accuracy.deltaPp >= 0 ? '+' : ''}${accuracy.deltaPp.toFixed(1)}pp vs last week`
                : 'Stable'
          }
        />
        <StatCard
          title="Weakest Area"
          value={<span style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}>—</span>}
          pending
          caption="Wire pending Phase 2 event history"
        />
        <StatCard
          title="Study Time"
          value=""
          pending
          caption="Wire pending Phase 2 event history"
        />
      </div>

      {/* Main row 2:1 — chart + recommendations */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <Card>
          <CardTitle>Retention Trend</CardTitle>
          <RetentionTrendChart />
        </Card>
        <Card>
          <CardTitle>Recommendations</CardTitle>
          <InsightStack>
            <Insight>Review Sicilian pawn structures.</Insight>
            <Insight>Reinforce delayed castling responses.</Insight>
            <Insight>Focus on dark-square weaknesses.</Insight>
            <Insight>Revise tactical forks in sharp e4 openings.</Insight>
          </InsightStack>
        </Card>
      </div>

      {/* Secondary row 1.3:1:1 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.3fr 1fr 1fr',
          gap: 18,
        }}
      >
        <Card>
          <CardTitle>Opening Performance</CardTitle>
          <PerformanceHeatmap />
        </Card>
        <Card>
          <CardTitle>Weak Structures</CardTitle>
          <InsightStack>
            <Insight>IQP positions under pressure.</Insight>
            <Insight>Kingside dark-square weaknesses.</Insight>
            <Insight>Late rook activation in closed positions.</Insight>
          </InsightStack>
        </Card>
        <Card>
          <CardTitle>Recurring Mistakes</CardTitle>
          <InsightStack>
            <Insight>Delayed queenside development.</Insight>
            <Insight>Overextension during flank attacks.</Insight>
            <Insight>Missed tactical forks after exchanges.</Insight>
          </InsightStack>
        </Card>
      </div>
    </PageBody>
  );
}

function SelectPill({
  ariaLabel,
  options,
}: {
  ariaLabel: string;
  options: string[];
}) {
  const t = useTokens();
  return (
    <select
      aria-label={ariaLabel}
      style={{
        background: t.surface,
        border: `0.5px solid ${t.border}`,
        color: t.ink,
        padding: '9px 14px',
        borderRadius: 12,
        fontSize: 12.5,
        fontFamily: fonts.sans,
        cursor: 'pointer',
      }}
    >
      {options.map((opt) => (
        <option key={opt}>{opt}</option>
      ))}
    </select>
  );
}
