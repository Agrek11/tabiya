/**
 * DashboardPage — Phase 1 wires real SRS stats.
 *
 * "Lines mastered" = count(SrsState where box >= 4) / catalog.lines.length.
 * "Due for review" = dueLineIds.length from useSRS.
 * "Drill" CTA points to /drill?queue=due when due lines exist; else
 * Repertoire (the existing default).
 *
 * Empty state when no lines have ever been drilled (states.size === 0):
 * guide the user to the Repertoire to pick a first line.
 */

import { useEffect, useState } from 'react';
import { Inbox, LineChart, Target, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '../ui/primitives/PageHeader';
import { StateMessage } from '../ui/primitives/StateMessage';
import { Button } from '../ui/primitives/Button';
import { Card } from '../ui/primitives/Card';
import { useTokens } from '../theme/ThemeContext';
import { fonts, radius } from '../theme/tokens';
import { useSRS } from '../hooks/useSRS';
import { getRepository } from '../storage';
import type { Line } from '../storage/types';

export function DashboardPage() {
  const t = useTokens();
  const { states, dueLineIds, loading } = useSRS();
  const [totalLines, setTotalLines] = useState<number | null>(null);

  useEffect(() => {
    const repo = getRepository();
    let cancelled = false;
    void (async () => {
      try {
        const ops = await repo.listOpenings();
        const lineLists = await Promise.all(ops.map((o) => repo.listLines(o.id)));
        if (!cancelled) setTotalLines(lineLists.flat().length as Line[]['length']);
      } catch {
        if (!cancelled) setTotalLines(0);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading || totalLines === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader title="Dashboard" subtitle="Loading…" />
      </div>
    );
  }

  if (states.size === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <PageHeader title="Dashboard" subtitle="Pick a line and complete one drill to start tracking." />
        <StateMessage
          icon={LineChart}
          title="No drills yet"
          body="Browse the Repertoire and pick an opening. The first drill seeds your SRS history; mastery and due-for-review numbers appear here as you progress."
          action={
            <Link to="/repertoire" style={{ textDecoration: 'none' }}>
              <Button variant="primary">Browse repertoire →</Button>
            </Link>
          }
        />
      </div>
    );
  }

  const masteredCount = Array.from(states.values()).filter((s) => s.box >= 4).length;
  const masteredPct =
    totalLines === 0 ? 0 : Math.round((masteredCount / totalLines) * 100);
  const dueCount = dueLineIds.length;
  const drillHref = dueCount > 0 ? '/drill?queue=due' : '/repertoire';
  const drillLabel = dueCount > 0 ? `Drill ${dueCount} due` : 'Browse repertoire';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <PageHeader
        title="Dashboard"
        subtitle="Your spaced-repetition snapshot."
        actions={
          <Link to={drillHref} style={{ textDecoration: 'none' }}>
            <Button variant="primary">{drillLabel} →</Button>
          </Link>
        }
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 14,
        }}
      >
        <StatCard
          icon={<Target size={16} color={t.brand} />}
          label="Lines mastered"
          value={`${masteredPct}%`}
          sub={`${masteredCount} of ${totalLines}`}
        />
        <StatCard
          icon={<Calendar size={16} color={t.brand} />}
          label="Due for review"
          value={String(dueCount)}
          sub={dueCount === 0 ? 'All caught up' : 'Lines past their interval'}
        />
        <StatCard
          icon={<LineChart size={16} color={t.brand} />}
          label="Drilled lines"
          value={String(states.size)}
          sub={`out of ${totalLines}`}
        />
      </div>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Inbox size={15} color={t.inkDim} />
          <div style={{ fontWeight: 600, fontFamily: fonts.sans, fontSize: 14, color: t.ink }}>
            Activity feed
          </div>
        </div>
        <div style={{ fontSize: 13, color: t.inkDim, fontFamily: fonts.sans }}>
          Detailed activity, accuracy trends, and the practice-rhythm heatmap activate after Phase 1.5 ships the session event log.
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  const t = useTokens();
  return (
    <Card padding={16}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {icon}
        <div style={{ fontSize: 12, color: t.inkDim, fontFamily: fonts.sans, fontWeight: 600 }}>
          {label}
        </div>
      </div>
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: t.ink,
          fontFamily: fonts.sans,
          letterSpacing: -0.5,
          marginBottom: 4,
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>{sub}</div>
      <div
        style={{
          height: 4,
          background: t.surfaceAlt,
          borderRadius: radius.full,
          marginTop: 10,
          overflow: 'hidden',
        }}
      />
    </Card>
  );
}
