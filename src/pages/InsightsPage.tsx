/**
 * InsightsPage — analytics surface (Phase 1.5 / 2).
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="insights"`.
 *
 * Honesty rule: only Accuracy is wired to real data (Phase 1.5 events) today.
 * Everything that needs full event history (retention trend, per-opening
 * heatmap, weakness/recommendation lists) renders an explicit PENDING state
 * rather than fabricated bars/copy — same convention as the StatCard tiles.
 * The non-functional time/opening filters were removed until they drive a query.
 */

import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { StatCard } from '../ui/primitives/StatCard';
import { EventsContextProvider } from '../state/EventsContext';
import { useAccuracy } from '../hooks/useAccuracy';

const PENDING_CAPTION = 'Wire pending Phase 2 event history';

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
      <div style={{ marginBottom: 24 }}>
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
        <p style={{ margin: '6px 0 0', color: t.inkDim, fontSize: 13.5, fontFamily: fonts.sans }}>
          Performance patterns, weaknesses, retention, and learning analytics.
        </p>
      </div>

      {/* KPI grid — only Accuracy is real; the rest are honestly pending. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <StatCard title="Retention" tone="brand" value="" pending caption={PENDING_CAPTION} />
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
          caption={PENDING_CAPTION}
        />
        <StatCard title="Study Time" value="" pending caption={PENDING_CAPTION} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
        <Card id="insights-retention">
          <CardTitle>Retention Trend</CardTitle>
          <PendingPanel height={260} />
        </Card>
        <Card id="insights-recommendations">
          <CardTitle>Recommendations</CardTitle>
          <PendingPanel height={160} />
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 18 }}>
        <Card id="insights-opening">
          <CardTitle>Opening Performance</CardTitle>
          <PendingPanel height={150} />
        </Card>
        <Card id="insights-weak">
          <CardTitle>Weak Structures</CardTitle>
          <PendingPanel height={150} />
        </Card>
        <Card id="insights-mistakes">
          <CardTitle>Recurring Mistakes</CardTitle>
          <PendingPanel height={150} />
        </Card>
      </div>
    </PageBody>
  );
}

/** Honest empty state for analytics that need event history not yet recorded. */
function PendingPanel({ height }: { height: number }) {
  const t = useTokens();
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        color: t.inkSoft,
        fontFamily: fonts.sans,
        fontSize: 12.5,
        lineHeight: 1.6,
        padding: '0 12px',
      }}
    >
      Personalized analytics appear once enough drill history is recorded.
    </div>
  );
}
