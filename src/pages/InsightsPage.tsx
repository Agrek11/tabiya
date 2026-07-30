/**
 * InsightsPage — analytics surface (Phase 1.5 / 2).
 *
 * Source: specs/wireframes/tabiya-v1-preview.html `data-page="insights"`.
 *
 * Local event history drives clean-recall retention, recorded study time, and
 * per-opening drill performance. Game-analysis signals remain separately
 * derived from analyzed games and correction drills. Surfaces with no history
 * render an explicit empty state rather than fabricated bars or trends.
 *
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { StatCard } from '../ui/primitives/StatCard';
import { EventsContextProvider } from '../state/EventsContext';
import { useAccuracy } from '../hooks/useAccuracy';
import { getGameAnalysisRepository, getGhostLineRepository } from '../storage';
import { formatStudyTime } from '../analytics/progress';
import { useProgressAnalytics } from '../hooks/useProgressAnalytics';
import { computeMcl, detectLeaks, type LeakScore } from '../analysis/leakDetector';
import { clusterGhostBlunders, type BlunderDnaCluster } from '../analysis/blunderDna';
import { recommendationsFromDna, type StudyRecommendation } from '../analysis/recommendations';

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
  const { summary: progress } = useProgressAnalytics();
  const accuracyValue = accAllTime !== null ? `${Math.round(accAllTime * 100)}%` : null;
  const [analysisSummary, setAnalysisSummary] = useState<{
    analyzedGames: number;
    avgMcl: number | null;
    topMistakes: Array<{ gameId: string; cpLoss: number; san: string }>;
    ghostCount: number;
    latestGhostId: string | null;
    blunderDna: BlunderDnaCluster[];
    recommendations: StudyRecommendation[];
    leakSignals: LeakScore[];
  }>({
    analyzedGames: 0,
    avgMcl: null,
    topMistakes: [],
    ghostCount: 0,
    latestGhostId: null,
    blunderDna: [],
    recommendations: [],
    leakSignals: [],
  });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [all, ghosts] = await Promise.all([
        getGameAnalysisRepository().listAll(),
        getGhostLineRepository().listAll(),
      ]);
      if (cancelled) return;
      const mcls = all.map((a) => computeMcl(a)).filter((v) => Number.isFinite(v));
      const avgMcl = mcls.length > 0 ? Math.round(mcls.reduce((a, b) => a + b, 0) / mcls.length) : null;
      const topMistakes = all
        .flatMap((a) =>
          a.plies
            .map((p) => ({
              gameId: a.gameId,
              cpLoss: Number(p.cpLoss),
              san: String(p.san ?? ''),
            }))
            .filter((x) => Number.isFinite(x.cpLoss)),
        )
        .sort((a, b) => b.cpLoss - a.cpLoss)
        .slice(0, 5);
      const latestGhostId = ghosts.sort((a, b) => b.created_at - a.created_at)[0]?.id ?? null;
      const blunderDna = clusterGhostBlunders(ghosts);
      const recommendations = recommendationsFromDna(blunderDna);
      const leakSignals = detectLeaks(
        all,
        (a) => {
          const top = a.plies
            .map((p) => ({ cpLoss: Number(p.cpLoss), san: String(p.san ?? '') }))
            .filter((x) => Number.isFinite(x.cpLoss))
            .sort((x, y) => y.cpLoss - x.cpLoss)[0];
          return top?.san ? `recurring:${top.san}` : 'recurring:unknown';
        },
        { minMcl: 70, minGames: 2 },
      );
      setAnalysisSummary({
        analyzedGames: all.length,
        avgMcl,
        topMistakes,
        ghostCount: ghosts.length,
        latestGhostId,
        blunderDna,
        recommendations,
        leakSignals,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
        <StatCard
          title="Retention"
          tone="brand"
          value={progress.retention === null ? '' : `${progress.retention}%`}
          pending={progress.retention === null}
          caption={progress.retention === null ? 'No completed drill sessions yet' : `${progress.cleanSessions}/${progress.terminalSessions} clean sessions`}
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
          value={
            analysisSummary.avgMcl !== null ? (
              <span style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}>MCL {analysisSummary.avgMcl}</span>
            ) : (
              <span style={{ fontSize: 19, fontWeight: 600, lineHeight: 1.3 }}>—</span>
            )
          }
          pending={analysisSummary.avgMcl === null}
          caption={analysisSummary.avgMcl === null ? PENDING_CAPTION : `${analysisSummary.analyzedGames} analyzed games`}
        />
        <StatCard
          title="Study Time"
          value={progress.terminalSessions === 0 ? '' : formatStudyTime(progress.totalStudyMs)}
          pending={progress.terminalSessions === 0}
          caption={progress.terminalSessions === 0 ? 'No closed drill sessions yet' : `${progress.terminalSessions} recorded sessions`}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18, marginBottom: 18 }}>
        <Card id="insights-retention">
          <CardTitle>Retention Trend</CardTitle>
          <RetentionTrend />
        </Card>
        <Card id="insights-recommendations">
          <CardTitle>Recommendations</CardTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: fonts.sans }}>
            <div style={{ fontSize: 12.5, color: t.ink }}>
              Injected ghost drills: <b>{analysisSummary.ghostCount}</b>
            </div>
            {analysisSummary.latestGhostId ? (
              <Link to={`/drill?line=${encodeURIComponent(analysisSummary.latestGhostId)}`} style={{ color: t.brand }}>
                Continue latest ghost correction
              </Link>
            ) : (
              <p style={{ margin: 0, fontSize: 12.5, color: t.inkSoft }}>
                Review recent games and add ghost candidates to drills.
              </p>
            )}
            <Link to="/training/structures" style={{ color: t.brand }}>
              Open structure-first training
            </Link>
            <Link to="/search/features" style={{ color: t.brand }}>
              Open feature/tag search
            </Link>
            {analysisSummary.recommendations.map((r) => (
              <a key={r.key} href={r.url} target="_blank" rel="noreferrer" style={{ color: t.brand, fontSize: 12.5 }}>
                {r.title} → {r.resource}
              </a>
            ))}
          </div>
        </Card>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 18 }}>
        <Card id="insights-opening">
          <CardTitle>Opening Performance</CardTitle>
          <OpeningPerformanceBreakdown />
        </Card>
        <Card id="insights-weak">
          <CardTitle>Blunder DNA</CardTitle>
          {analysisSummary.blunderDna.length === 0 ? (
            <PendingPanel height={150} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: fonts.sans }}>
              {analysisSummary.blunderDna.slice(0, 4).map((c) => (
                <div key={c.key} style={{ fontSize: 12.5, color: t.ink }}>
                  <b>{c.label}</b> · {c.count}
                  {c.examples.length > 0 ? (
                    <span style={{ color: t.inkSoft }}> (e.g. {c.examples.join(', ')})</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card id="insights-mistakes">
          <CardTitle>Leak Signals</CardTitle>
          {analysisSummary.leakSignals.length === 0 ? (
            <PendingPanel height={150} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: fonts.sans }}>
              {analysisSummary.leakSignals.slice(0, 5).map((s) => (
                <div key={s.key} style={{ fontSize: 12.5, color: t.ink }}>
                  <span style={{ fontFamily: fonts.mono }}>{s.key.replace('recurring:', '')}</span>
                  {' '}· MCL {s.mcl} · {s.games} games
                  {s.flagged ? (
                    <span style={{ color: t.red, marginLeft: 6 }}>flagged</span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
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
function RetentionTrend() {
  const t = useTokens();
  const { summary } = useProgressAnalytics();
  if (summary.terminalSessions === 0) return <PendingPanel height={260} />;
  return (
    <div style={{ height: 260, display: 'flex', alignItems: 'end', gap: 10, padding: '16px 4px 2px' }}>
      {summary.trend.map((point) => {
        const height = point.retention === null ? 6 : Math.max(12, point.retention * 1.8);
        return (
          <div key={point.day} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: fonts.sans }}>
            <div style={{ height: 190, display: 'flex', alignItems: 'end', justifyContent: 'center' }}>
              <div
                title={point.retention === null ? point.day + ': no completed sessions' : point.day + ': ' + point.retention + '% clean recall'}
                style={{ width: '100%', maxWidth: 34, height, borderRadius: '8px 8px 2px 2px', background: point.retention === null ? t.border : t.brand }}
              />
            </div>
            <div style={{ fontSize: 11, color: t.inkDim, marginTop: 8 }}>{point.day}</div>
            <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 2 }}>{point.retention === null ? '—' : point.retention + '%'}</div>
          </div>
        );
      })}
    </div>
  );
}

function OpeningPerformanceBreakdown() {
  const t = useTokens();
  const { summary } = useProgressAnalytics();
  if (summary.openingPerformance.length === 0) return <PendingPanel height={150} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: fonts.sans }}>
      {summary.openingPerformance.slice(0, 5).map((opening) => (
        <div key={opening.openingId} style={{ borderBottom: '0.5px solid ' + t.border, paddingBottom: 7 }}>
          <div style={{ color: t.ink, fontSize: 12.5, fontWeight: 600 }}>{opening.openingName}</div>
          <div style={{ color: t.inkSoft, fontSize: 11.5, marginTop: 2 }}>
            {opening.sessions} session{opening.sessions === 1 ? '' : 's'} · {opening.accuracy === null ? 'no moves scored' : opening.accuracy + '% move accuracy'} · {formatStudyTime(opening.studyMs)}
          </div>
        </div>
      ))}
    </div>
  );
}
