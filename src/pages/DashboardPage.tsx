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
 * Current Focus persists locally. Recommended Study Plan prioritizes the
 * selected focus, due reviews, and detected correction signals; Weak Structures
 * is derived from correction-drill tags created from game analysis.
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
import { useSRS } from '../hooks/useSRS';
import { useStreaks } from '../hooks/useStreaks';
import { useAccuracy } from '../hooks/useAccuracy';
import { getRepository } from '../storage';
import { EventsContextProvider } from '../state/EventsContext';
import { OOBWidget } from '../components/dashboard/OOBWidget';
import { buildStudyPlan } from '../analytics/studyPlan';
import { useStudyFocus, STUDY_FOCUS_OPTIONS } from '../hooks/useStudyFocus';
import { useStudySignals } from '../hooks/useStudySignals';


const ONBOARDING_DISMISS_KEY = 'tabiya.onboarding.v1.dismissed';
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
  const signals = useStudySignals();
  const [focus, setFocus] = useStudyFocus();
  const [totalLines, setTotalLines] = useState<number | null>(null);
  const [onboardingDismissed, setOnboardingDismissed] = useState(() => window.localStorage.getItem(ONBOARDING_DISMISS_KEY) === '1');

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
  const dismissOnboarding = (): void => {
    window.localStorage.setItem(ONBOARDING_DISMISS_KEY, '1');
    setOnboardingDismissed(true);
  };

  const masteredCount = Array.from(states.values()).filter((s) => s.box >= 4).length;
  const dueCount = dueLineIds.length;
  const totalLinesValue = totalLines ?? 0;
  const drillHref = dueCount > 0 ? '/drill?queue=due' : '/drill';
  const studyPlan = buildStudyPlan(focus, dueCount, signals);

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
      {states.size === 0 && !onboardingDismissed && (
        <Card>
          <CardTitle>Welcome to Tabiya</CardTitle>
          <p style={{ margin: '0 0 14px', color: t.inkDim, fontFamily: fonts.sans, lineHeight: 1.6 }}>
            Start with an opening you want to own. Tabiya will turn each drill into a local review schedule; game sync is optional.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <Link to="/repertoire" style={{ color: t.brand, fontFamily: fonts.sans, fontWeight: 600 }}>
              1. Choose a repertoire
            </Link>
            <Link to="/drill" style={{ color: t.brand, fontFamily: fonts.sans, fontWeight: 600 }}>
              2. Drill your first line
            </Link>
            <Link to="/games" style={{ color: t.ink, fontFamily: fonts.sans }}>
              3. Connect games (optional)
            </Link>
            <button
              type="button"
              onClick={dismissOnboarding}
              style={{ border: 0, background: 'transparent', color: t.inkSoft, cursor: 'pointer', fontFamily: fonts.sans }}
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

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

      {/* Secondary row ×2 — static v1 placeholders */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        <Card>
          <CardTitle>Current Focus</CardTitle>
          <p style={{ margin: '0 0 10px', color: t.inkDim, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 1.55 }}>
            Saved on this device. Your plan updates immediately.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {STUDY_FOCUS_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setFocus(option.id)}
                aria-pressed={focus === option.id}
                style={{
                  border: '0.5px solid ' + (focus === option.id ? t.brand : t.border),
                  background: focus === option.id ? t.brandSoft : t.surfaceAlt,
                  color: t.ink,
                  borderRadius: 999,
                  padding: '5px 8px',
                  cursor: 'pointer',
                  fontFamily: fonts.sans,
                  fontSize: 11.5,
                  fontWeight: focus === option.id ? 600 : 500,
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </Card>
        <Card>
        <Card>
          <CardTitle>Recommended Study Plan</CardTitle>
          <div style={{ color: t.ink, fontFamily: fonts.sans, fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>
            {studyPlan.title}
          </div>
          <p style={{ margin: '6px 0 10px', color: t.inkDim, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 1.55 }}>
            {studyPlan.reason}
          </p>
          <Link to={studyPlan.href} style={{ color: t.brand, fontFamily: fonts.sans, fontSize: 12.5, fontWeight: 600 }}>
            {studyPlan.action}
          </Link>
        </Card>
          <CardTitle>Weak Structures</CardTitle>
          {signals.structureSignals.length === 0 ? (
            <div style={{ color: t.inkSoft, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 1.55 }}>
              Review a game and add correction drills to reveal recurring structures.
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: fonts.sans, fontSize: 12.5, color: t.ink }}>
                {signals.structureSignals.slice(0, 3).map((signal) => (
                  <div key={signal.label}>
                    <b>{signal.label}</b> · {signal.count} correction{signal.count === 1 ? '' : 's'}
                  </div>
                ))}
              </div>
              <Link to="/training/structures" style={{ display: 'inline-block', marginTop: 10, color: t.brand, fontFamily: fonts.sans, fontSize: 12.5, fontWeight: 600 }}>
                Train structures
              </Link>
            </>
          )}
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

