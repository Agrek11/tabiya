/**
 * DashboardPage — "Continue Your Training" home, matched to v1 preview.
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="home"`.
 *
 * Layout:
 *   PageHeader
 *   Hero row (2:1):     Up Next  |  Recent Improvement
 *   KPI grid (×4):      Streak / Due Today / Accuracy / Mastered
 *   Secondary (×3):     Current Focus / Weak Structures / Quick Actions
 *
 * Wiring:
 *   - Streak  = useStreaks().drillDayStreak (Phase 1.5)
 *   - Due     = useSRS().dueLineIds.length
 *   - Accuracy = useAccuracy().allTime (Phase 1.5)
 *   - Mastered = count(SrsState.box >= 4) / catalog.lines.length
 *
 * Unwired surfaces (Current Focus, Weak Structures, hero subtitle) show static
 * v1 copy. They light up post-Phase 3/4 with detected weaknesses and saved
 * focus state.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { Insight } from '../ui/primitives/Insight';
import { useSRS } from '../hooks/useSRS';
import { useStreaks } from '../hooks/useStreaks';
import { useAccuracy } from '../hooks/useAccuracy';
import { getRepository } from '../storage';
import { EventsContextProvider } from '../state/EventsContext';
import { OOBWidget } from '../components/dashboard/OOBWidget';

export function DashboardPage() {
  return (
    <EventsContextProvider>
      <DashboardBody />
    </EventsContextProvider>
  );
}

function DashboardBody() {
  const t = useTokens();
  const { states, dueLineIds, loading } = useSRS();
  const streaks = useStreaks();
  const accuracy = useAccuracy();
  const [totalLines, setTotalLines] = useState<number | null>(null);

  useEffect(() => {
    const repo = getRepository();
    let cancelled = false;
    void (async () => {
      try {
        const ops = await repo.listOpenings();
        const lineLists = await Promise.all(ops.map((o) => repo.listLines(o.id)));
        if (!cancelled) setTotalLines(lineLists.flat().length);
      } catch {
        if (!cancelled) setTotalLines(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const masteredCount = Array.from(states.values()).filter((s) => s.box >= 4).length;
  const dueCount = dueLineIds.length;
  const totalLinesValue = totalLines ?? 0;
  const drillHref = dueCount > 0 ? '/drill?queue=due' : '/drill';

  const accAllTime = accuracy.allTime.accuracy;
  const accuracyText = accAllTime !== null ? `${(accAllTime * 100).toFixed(1)}%` : null;
  const accuracyCaption =
    accuracy.deltaPp !== null
      ? `${accuracy.deltaPp >= 0 ? '+' : ''}${accuracy.deltaPp.toFixed(1)}pp vs last week`
      : 'No data yet';

  const streakText = streaks.drillDayStreak > 0 ? String(streaks.drillDayStreak) : null;
  const streakCaption =
    streaks.lineMasteryStreak > 0
      ? `${streaks.lineMasteryStreak} clean line streak`
      : 'Drill daily to build a streak';

  if (loading || totalLines === null) {
    return (
      <PageBody>
        <PageHeader title="Continue Your Training" subtitle="Loading…" />
      </PageBody>
    );
  }

  return (
    <PageBody>
      <PageHeader
        title="Continue Your Training"
        subtitle="Focused, long-term chess improvement through guided learning."
      />

      {/* Hero row 2:1 — Up Next + Recent Improvement */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: 18,
          marginBottom: 18,
        }}
      >
        <Card>
          <CardTitle>Up Next</CardTitle>
          <h3
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 700,
              color: t.ink,
              letterSpacing: '-0.02em',
              marginBottom: 10,
              fontFamily: fonts.sans,
            }}
          >
            {dueCount > 0
              ? `${dueCount} lines due for review`
              : states.size === 0
                ? 'Pick your first opening'
                : 'All caught up'}
          </h3>
          <div
            style={{
              fontSize: 13,
              color: t.inkDim,
              lineHeight: 1.6,
              marginBottom: 22,
              fontFamily: fonts.sans,
            }}
          >
            {dueCount > 0
              ? 'Resume the spaced-repetition queue. We pick the order — you focus on accuracy.'
              : states.size === 0
                ? 'Browse the repertoire and drill any line to seed your SRS history.'
                : 'No reviews due. Drill any line to deepen mastery, or come back tomorrow.'}
          </div>
          <Link to={drillHref} style={{ textDecoration: 'none' }}>
            <button
              data-testid="resume-session-cta"
              style={{
                background: t.brand,
                color: t.brandInk,
                border: 'none',
                padding: '10px 18px',
                borderRadius: 10,
                fontSize: 13,
                fontWeight: 600,
                fontFamily: fonts.sans,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Play size={14} fill="currentColor" stroke="none" />
              {states.size === 0 ? 'Start Drilling' : 'Resume Session'}
            </button>
          </Link>
        </Card>
        <Card>
          <CardTitle>Recent Improvement</CardTitle>
          <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.65, fontFamily: fonts.sans }}>
            {accuracy.deltaPp !== null && accuracy.deltaPp > 0 ? (
              <>
                Your retention improved by{' '}
                <strong style={{ color: t.success }}>+{accuracy.deltaPp.toFixed(1)}pp</strong> this week.
              </>
            ) : (
              <span style={{ color: t.inkDim, fontStyle: 'italic' }}>
                Drill a few lines this week to see retention trends.
              </span>
            )}
          </div>
        </Card>
      </div>

      {/* KPI grid ×4 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 14,
          marginBottom: 18,
        }}
      >
        <KpiCard
          title="Streak"
          tone="brand"
          value={
            streakText !== null ? (
              <>
                {streakText}{' '}
                <span style={{ fontSize: 14, color: t.inkSoft, fontWeight: 500 }}>days</span>
              </>
            ) : (
              '—'
            )
          }
          caption={streakCaption}
          pending={streakText === null}
        />
        <KpiCard
          title="Due Today"
          value={String(dueCount)}
          caption={dueCount === 0 ? 'All caught up' : 'Lines past their interval'}
        />
        <KpiCard
          title="Accuracy"
          tone="success"
          value={accuracyText ?? '—'}
          caption={accuracyCaption}
          pending={accuracyText === null}
        />
        <KpiCard
          title="Mastered"
          value={
            <>
              {masteredCount}
              <span style={{ fontSize: 18, color: t.inkSoft, fontWeight: 500 }}>
                /{totalLinesValue}
              </span>
            </>
          }
          caption={masteredCount === 0 ? 'Drill to start mastering' : 'Box 4+'}
        />
      </div>

      {/* Out-of-book moments (Phase 3) */}
      <div style={{ marginBottom: 18 }}>
        <OOBWidget />
      </div>

      {/* Secondary row ×3 — static v1 placeholders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        <Card>
          <CardTitle>Current Focus</CardTitle>
          <div style={{ fontSize: 13, color: t.ink, lineHeight: 1.65, fontFamily: fonts.sans }}>
            {/* Wire in Phase 3/4 — drives off detected weakness + saved focus state */}
            Pick a study focus to spotlight specific patterns in your drilling.
          </div>
        </Card>
        <Card>
          <CardTitle>Weak Structures</CardTitle>
          <Insight>
            {/* Wire in Phase 3/4 — feeds from detected pattern analysis */}
            Connect a game source under Games to detect recurring structural weaknesses.
          </Insight>
        </Card>
        <Card>
          <CardTitle>Quick Actions</CardTitle>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
            <QuickAction to={drillHref} label="Drill due" />
            <QuickAction to="/repertoire" label="Browse" />
            <QuickAction to="/insights" label="Insights" />
          </div>
        </Card>
      </div>
    </PageBody>
  );
}

function KpiCard({
  title,
  value,
  caption,
  tone = 'default',
  pending = false,
}: {
  title: string;
  value: React.ReactNode;
  caption: string;
  tone?: 'default' | 'brand' | 'success';
  pending?: boolean;
}) {
  const t = useTokens();
  const color = pending ? t.inkSoft : tone === 'brand' ? t.brand : tone === 'success' ? t.success : t.ink;
  return (
    <Card>
      <CardTitle>{title}</CardTitle>
      <div
        style={{
          fontSize: 32,
          fontWeight: 700,
          color,
          letterSpacing: '-0.02em',
          fontFamily: fonts.sans,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 12,
          color: t.inkSoft,
          marginTop: 6,
          fontFamily: fonts.sans,
          fontStyle: pending ? 'italic' : 'normal',
        }}
      >
        {caption}
      </div>
    </Card>
  );
}

function QuickAction({ to, label }: { to: string; label: string }) {
  const t = useTokens();
  return (
    <Link
      to={to}
      style={{
        padding: '7px 12px',
        background: t.surfaceAlt,
        border: `0.5px solid ${t.border}`,
        borderRadius: 10,
        fontSize: 12,
        color: t.ink,
        fontWeight: 500,
        fontFamily: fonts.sans,
        textDecoration: 'none',
        cursor: 'pointer',
      }}
    >
      {label}
    </Link>
  );
}
