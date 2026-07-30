import { Link } from 'react-router-dom';
import { formatStudyTime } from '../analytics/progress';
import { useProgressAnalytics } from '../hooks/useProgressAnalytics';
import { useStreaks } from '../hooks/useStreaks';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { EventsContextProvider } from '../state/EventsContext';

export function ProgressPage(): React.JSX.Element {
  return (
    <EventsContextProvider>
      <ProgressBody />
    </EventsContextProvider>
  );
}

function ProgressBody(): React.JSX.Element {
  const t = useTokens();
  const { summary, loading } = useProgressAnalytics();
  const streaks = useStreaks();

  return (
    <PageBody>
      <PageHeader
        title="Progress"
        subtitle="Your local drill history: clean recall, study time, and opening performance."
      />
      {loading ? (
        <Card><div style={{ color: t.inkSoft, fontFamily: fonts.sans }}>Loading local progress…</div></Card>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
            <Metric label="Clean recall" value={summary.retention === null ? '—' : summary.retention + '%'} detail={summary.terminalSessions === 0 ? 'Complete a drill to start tracking' : summary.cleanSessions + '/' + summary.terminalSessions + ' clean sessions'} />
            <Metric label="Study time" value={formatStudyTime(summary.totalStudyMs)} detail={summary.terminalSessions + ' recorded sessions'} />
            <Metric label="Daily streak" value={String(streaks.drillDayStreak)} detail="Consecutive days with a drill" />
            <Metric label="Clean-line streak" value={String(streaks.lineMasteryStreak)} detail="Consecutive clean completions" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 18, marginBottom: 18 }}>
            <Card>
              <CardTitle>Seven-day clean recall</CardTitle>
              {summary.terminalSessions === 0 ? (
                <EmptyState>Complete a line to plot your clean-recall trend.</EmptyState>
              ) : (
                <div style={{ height: 230, display: 'flex', alignItems: 'end', gap: 10, padding: '12px 4px 0' }}>
                  {summary.trend.map((point) => (
                    <div key={point.day} style={{ flex: 1, minWidth: 0, textAlign: 'center', fontFamily: fonts.sans }}>
                      <div style={{ height: 170, display: 'flex', alignItems: 'end', justifyContent: 'center' }}>
                        <div style={{ width: '100%', maxWidth: 36, height: point.retention === null ? 6 : Math.max(12, point.retention * 1.6), borderRadius: '8px 8px 2px 2px', background: point.retention === null ? t.border : t.brand }} />
                      </div>
                      <div style={{ color: t.inkDim, fontSize: 11, marginTop: 8 }}>{point.day}</div>
                      <div style={{ color: t.inkSoft, fontSize: 11 }}>{point.retention === null ? '—' : point.retention + '%'}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card>
              <CardTitle>What counts as retention?</CardTitle>
              <p style={{ margin: 0, color: t.inkDim, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 1.6 }}>
                A clean recall is a completed line with no wrong moves. It shows whether the whole line is sticking, not just individual move accuracy.
              </p>
              <Link to="/insights" style={{ display: 'inline-block', marginTop: 12, color: t.brand, fontFamily: fonts.sans, fontSize: 12.5, fontWeight: 600 }}>
                See game-analysis insights
              </Link>
            </Card>
          </div>
          <Card>
            <CardTitle>Opening performance</CardTitle>
            {summary.openingPerformance.length === 0 ? (
              <EmptyState>Drill a repertoire line to build an opening-by-opening breakdown.</EmptyState>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, fontFamily: fonts.sans }}>
                {summary.openingPerformance.map((opening) => (
                  <div key={opening.openingId} style={{ display: 'grid', gridTemplateColumns: '1.4fr repeat(3, 1fr)', gap: 8, borderBottom: '0.5px solid ' + t.border, paddingBottom: 9 }}>
                    <span style={{ color: t.ink, fontWeight: 600, fontSize: 13 }}>{opening.openingName}</span>
                    <span style={{ color: t.inkDim, fontSize: 12.5 }}>{opening.sessions} session{opening.sessions === 1 ? '' : 's'}</span>
                    <span style={{ color: t.inkDim, fontSize: 12.5 }}>{opening.accuracy === null ? '—' : opening.accuracy + '% accuracy'}</span>
                    <span style={{ color: t.inkDim, fontSize: 12.5 }}>{formatStudyTime(opening.studyMs)}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </PageBody>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }): React.JSX.Element {
  const t = useTokens();
  return (
    <Card>
      <CardTitle>{label}</CardTitle>
      <div style={{ color: t.ink, fontFamily: fonts.sans, fontSize: 30, fontWeight: 700 }}>{value}</div>
      <div style={{ color: t.inkSoft, fontFamily: fonts.sans, fontSize: 11.5, marginTop: 6 }}>{detail}</div>
    </Card>
  );
}

function EmptyState({ children }: { children: React.ReactNode }): React.JSX.Element {
  const t = useTokens();
  return <div style={{ minHeight: 100, display: 'flex', alignItems: 'center', color: t.inkSoft, fontFamily: fonts.sans, fontSize: 12.5, lineHeight: 1.6 }}>{children}</div>;
}

