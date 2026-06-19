/**
 * GamesPage — chess-platform games surface (Phase 3).
 *
 * READ surface over the live sync pipeline: connection status, sync summary,
 * recent activity, and weakest openings by out-of-book frequency — all from
 * `LichessRepository` + the OAuth/username state. The actual connect + sync
 * CONTROLS live in Settings (LichessSection / ChessComSection); this page links
 * there rather than duplicating the OAuth + cooldown logic.
 *
 * No fabricated data: every value derives from synced games / OOB events, with
 * honest empty states when nothing is connected or synced yet.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { PageBody } from '../ui/primitives/PageBody';
import { PageHeader } from '../ui/primitives/PageHeader';
import { Card } from '../ui/primitives/Card';
import { CardTitle } from '../ui/primitives/CardTitle';
import { Insight, InsightStack } from '../ui/primitives/Insight';
import { getLichessRepository } from '../lib/lichess/repository-di';
import {
  getStoredToken,
  isConnected,
  LICHESS_CONNECTED_EVENT,
  LICHESS_DISCONNECTED_EVENT,
} from '../lib/lichess/oauth';
import { syncRecentGames, syncChessComRecentGames } from '../lib/lichess/sync';
import { getChessComUsername } from '../lib/chesscom/api';
import { CHESSCOM_CHANGED_EVENT } from '../components/settings/ChessComSection';

type WeakOpening = { name: string; count: number };

type Summary = {
  imported: number;
  analyzed: number;
  oobCount: number;
  openings: number;
  weakOpenings: WeakOpening[];
};

const EMPTY_SUMMARY: Summary = {
  imported: 0,
  analyzed: 0,
  oobCount: 0,
  openings: 0,
  weakOpenings: [],
};

async function loadSummary(): Promise<Summary> {
  const repo = getLichessRepository();
  const games = await repo.listGames({ limit: 200 });
  const oob = await repo.getOOBEvents({ limit: 500 });

  const openings = new Set<string>();
  for (const g of games) {
    if (g.opening?.name) openings.add(g.opening.name);
  }

  const counts = new Map<string, number>();
  for (const e of oob) {
    const name = e.openingName ?? 'Unknown opening';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const weakOpenings: WeakOpening[] = [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    imported: games.length,
    analyzed: games.filter((g) => g.oobChecked).length,
    oobCount: oob.length,
    openings: openings.size,
    weakOpenings,
  };
}

export function GamesPage() {
  const t = useTokens();
  const [lichess, setLichess] = useState(isConnected());
  const [chesscom, setChesscom] = useState(getChessComUsername());
  const [summary, setSummary] = useState<Summary>(EMPTY_SUMMARY);
  const [syncing, setSyncing] = useState<null | 'lichess' | 'chesscom'>(null);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    const refresh = (): void => {
      setLichess(isConnected());
      setChesscom(getChessComUsername());
    };
    window.addEventListener(LICHESS_CONNECTED_EVENT, refresh);
    window.addEventListener(LICHESS_DISCONNECTED_EVENT, refresh);
    window.addEventListener(CHESSCOM_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(LICHESS_CONNECTED_EVENT, refresh);
      window.removeEventListener(LICHESS_DISCONNECTED_EVENT, refresh);
      window.removeEventListener(CHESSCOM_CHANGED_EVENT, refresh);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadSummary().then((s) => {
      if (!cancelled) setSummary(s);
    });
    return () => {
      cancelled = true;
    };
  }, [lichess, chesscom]);

  // Sync runs here so importing is reachable from the page the user actually
  // lands on (connecting in Settings only links the account — it does not
  // import). Errors surface inline; the summary reloads when done.
  const runSync = async (platform: 'lichess' | 'chesscom'): Promise<void> => {
    setSyncing(platform);
    setSyncMsg(`Syncing ${platform === 'lichess' ? 'Lichess' : 'chess.com'}…`);
    try {
      const result =
        platform === 'lichess'
          ? await syncRecentGames(getStoredToken()?.username ?? '')
          : await syncChessComRecentGames(chesscom ?? '');
      await result.detectionDone;
      setSyncMsg(
        `✓ ${platform === 'lichess' ? 'Lichess' : 'chess.com'}: ${result.synced} new, ${result.known} already known`,
      );
      setSummary(await loadSummary());
    } catch (err) {
      console.error(`[games] ${platform} sync failed:`, err);
      setSyncMsg(`✕ ${platform === 'lichess' ? 'Lichess' : 'chess.com'} sync failed — see console`);
    } finally {
      setSyncing(null);
    }
  };

  const anyConnected = lichess || chesscom !== null;

  return (
    <PageBody>
      <PageHeader
        title="Games"
        subtitle="Imported games, out-of-book moments, and activity from your connected platforms."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 18 }}>
        <Card id="games-platforms">
          <CardTitle>Connected Platforms</CardTitle>
          <PlatformRow
            name="Lichess"
            meta={lichess ? 'Connected' : 'Not connected'}
            connected={lichess}
            syncing={syncing === 'lichess'}
            syncDisabled={syncing !== null}
            onSync={lichess ? () => void runSync('lichess') : undefined}
          />
          <div style={{ marginTop: 12 }}>
            <PlatformRow
              name="Chess.com"
              meta={chesscom ? `Linked as ${chesscom}` : 'Not linked'}
              connected={chesscom !== null}
              syncing={syncing === 'chesscom'}
              syncDisabled={syncing !== null}
              onSync={chesscom ? () => void runSync('chesscom') : undefined}
            />
          </div>
          {syncMsg ? (
            <div style={{ fontSize: 12, color: t.inkDim, fontFamily: fonts.sans, marginTop: 12 }}>
              {syncMsg}
            </div>
          ) : null}
        </Card>

        <Card id="games-summary">
          <CardTitle>Sync Summary</CardTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
            <StatTile label="Imported" value={String(summary.imported)} />
            <StatTile label="Analyzed" value={String(summary.analyzed)} />
            <StatTile label="Out of Book" value={String(summary.oobCount)} />
            <StatTile label="Tracked Openings" value={String(summary.openings)} />
          </div>
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card id="games-weak">
          <CardTitle>Weakest Openings</CardTitle>
          <InsightStack>
            {summary.weakOpenings.length > 0 ? (
              summary.weakOpenings.map((w) => (
                <Insight key={w.name}>
                  {w.name} — {w.count} out-of-book {w.count === 1 ? 'moment' : 'moments'}
                </Insight>
              ))
            ) : (
              <Insight>
                {anyConnected
                  ? 'No out-of-book moments detected yet. Sync more games in Settings.'
                  : 'Connect a platform in Settings to surface your weakest openings.'}
              </Insight>
            )}
          </InsightStack>
        </Card>
      </div>

      <div style={{ marginTop: 18 }}>
        <Card>
          <CardTitle>Out-of-book moments</CardTitle>
          <p style={{ fontSize: 12.5, color: t.inkSoft, fontFamily: fonts.sans, lineHeight: 1.6, margin: 0 }}>
            Review where your games left your prep on the{' '}
            <Link to="/" style={{ color: t.brand }}>Dashboard</Link>, or manage syncing
            and connections in{' '}
            <Link to="/settings" style={{ color: t.brand }}>Settings</Link>.
          </p>
        </Card>
      </div>
    </PageBody>
  );
}

function PlatformRow({
  name,
  meta,
  connected,
  syncing,
  syncDisabled,
  onSync,
}: {
  name: string;
  meta: string;
  connected: boolean;
  syncing?: boolean;
  syncDisabled?: boolean;
  onSync?: () => void;
}) {
  const t = useTokens();
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        padding: 16,
        borderRadius: 14,
        background: t.surfaceAlt,
        border: `0.5px solid ${t.border}`,
      }}
    >
      <div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: t.ink,
            marginBottom: 3,
            fontFamily: fonts.sans,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {name}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: connected ? t.success : t.inkSoft,
              display: 'inline-block',
            }}
          />
        </div>
        <div style={{ fontSize: 12, color: t.inkSoft, fontFamily: fonts.sans }}>{meta}</div>
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
        {connected && onSync ? (
          <button
            onClick={onSync}
            disabled={syncDisabled}
            style={{
              background: t.brand,
              color: t.brandInk,
              border: 'none',
              padding: '8px 14px',
              borderRadius: 12,
              fontSize: 12.5,
              fontWeight: 600,
              fontFamily: fonts.sans,
              cursor: syncDisabled ? 'not-allowed' : 'pointer',
              opacity: syncDisabled ? 0.6 : 1,
            }}
          >
            {syncing ? 'Syncing…' : 'Sync now'}
          </button>
        ) : null}
        <Link
          to="/settings"
          style={{
            background: t.surface,
            color: t.ink,
            border: `0.5px solid ${t.border}`,
            padding: '8px 14px',
            borderRadius: 12,
            fontSize: 12.5,
            fontWeight: 500,
            fontFamily: fonts.sans,
            textDecoration: 'none',
          }}
        >
          {connected ? 'Manage' : 'Connect in Settings'}
        </Link>
      </div>
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  const t = useTokens();
  return (
    <div style={{ background: t.surfaceAlt, borderRadius: 12, padding: 14, fontFamily: fonts.sans }}>
      <div
        style={{
          fontSize: 10.5,
          color: t.inkSoft,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 600,
          marginBottom: 5,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.ink }}>{value}</div>
    </div>
  );
}
