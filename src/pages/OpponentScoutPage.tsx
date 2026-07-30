import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { getLichessRepository } from '../lib/lichess/repository-di';

type ScoutSummary = {
  games: number;
  oobEvents: number;
  topOpenings: Array<{ name: string; count: number }>;
  recentGames: string[];
};

export function OpponentScoutPage(): React.JSX.Element {
  const t = useTokens();
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<ScoutSummary | null>(null);
  const normalized = useMemo(() => username.trim().toLowerCase(), [username]);

  async function runScout(): Promise<void> {
    if (!normalized) return;
    setLoading(true);
    try {
      const repo = getLichessRepository();
      const [games, oob] = await Promise.all([
        repo.listGames({ limit: 500 }),
        repo.getOOBEvents({ limit: 2000 }),
      ]);
      const opponentGames = games.filter(
        (g) =>
          g.whiteUsername.toLowerCase() === normalized ||
          g.blackUsername.toLowerCase() === normalized,
      );
      const gameIds = new Set(opponentGames.map((g) => g.id));
      const oobForOpponent = oob.filter((e) => gameIds.has(e.gameId));
      const openingCounts = new Map<string, number>();
      for (const g of opponentGames) {
        const name = g.opening?.name ?? 'Unknown opening';
        openingCounts.set(name, (openingCounts.get(name) ?? 0) + 1);
      }
      const topOpenings = [...openingCounts.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);
      setSummary({
        games: opponentGames.length,
        oobEvents: oobForOpponent.length,
        topOpenings,
        recentGames: opponentGames.slice(0, 8).map((g) => g.id),
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <PageBody>
      <PageHeader
        title="Opponent Scouting"
        subtitle="Deterministic profile from synced public games already in your local cache."
      />
      <Card>
        <CardTitle>Scout Target</CardTitle>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter opponent username"
            style={{
              flex: 1,
              border: `0.5px solid ${t.border}`,
              borderRadius: 10,
              background: t.surface,
              color: t.ink,
              fontFamily: fonts.sans,
              fontSize: 13,
              padding: '8px 10px',
            }}
          />
          <button
            onClick={() => void runScout()}
            disabled={!normalized || loading}
            style={{
              border: `0.5px solid ${t.border}`,
              borderRadius: 10,
              background: t.surface,
              color: t.ink,
              fontFamily: fonts.sans,
              fontSize: 13,
              padding: '8px 12px',
              cursor: 'pointer',
            }}
          >
            {loading ? 'Scouting…' : 'Scout'}
          </button>
        </div>
      </Card>
      {summary ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <CardTitle>Summary</CardTitle>
            <p style={{ margin: 0, fontFamily: fonts.sans, color: t.ink, fontSize: 13 }}>
              Games: <b>{summary.games}</b> · OOB moments: <b>{summary.oobEvents}</b>
            </p>
          </Card>
          <Card>
            <CardTitle>Top Openings</CardTitle>
            {summary.topOpenings.length === 0 ? (
              <p style={{ margin: 0, fontFamily: fonts.sans, color: t.inkSoft, fontSize: 13 }}>
                No synced games for this username yet.
              </p>
            ) : (
              <ol style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {summary.topOpenings.map((o) => (
                  <li key={o.name} style={{ fontFamily: fonts.sans, color: t.ink, fontSize: 12.5 }}>
                    {o.name} ({o.count})
                  </li>
                ))}
              </ol>
            )}
          </Card>
          <Card>
            <CardTitle>Recent Game Reviews</CardTitle>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {summary.recentGames.map((id) => (
                <Link key={id} to={`/review/${id}`} style={{ color: t.brand, fontFamily: fonts.mono, fontSize: 12 }}>
                  {id}
                </Link>
              ))}
            </div>
          </Card>
        </div>
      ) : null}
    </PageBody>
  );
}
