/**
 * OOBWidget — Dashboard "Out-of-book moments" list (Phase 3 R7).
 *
 * Pure read surface over `LichessRepository.getOOBEvents()` — no mutation of
 * picks, SRS, or drill queue (R7 AC8). Three states: not connected /
 * connected-no-events / event list (10 per page, Load more).
 */

import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Card } from '../../ui/primitives/Card';
import { CardTitle } from '../../ui/primitives/CardTitle';
import { isConnected, LICHESS_CONNECTED_EVENT, LICHESS_DISCONNECTED_EVENT } from '../../lib/lichess/oauth';
import { getLichessRepository } from '../../lib/lichess/repository-di';
import type { LichessGame, OOBEvent } from '../../lib/lichess/types';

const PAGE = 10;

type Row = OOBEvent & { opponent: string; dateLabel: string };

export function OOBWidget() {
  const t = useTokens();
  const navigate = useNavigate();
  const [connected, setConnected] = useState(isConnected());
  const [rows, setRows] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const refresh = (): void => setConnected(isConnected());
    window.addEventListener(LICHESS_CONNECTED_EVENT, refresh);
    window.addEventListener(LICHESS_DISCONNECTED_EVENT, refresh);
    return () => {
      window.removeEventListener(LICHESS_CONNECTED_EVENT, refresh);
      window.removeEventListener(LICHESS_DISCONNECTED_EVENT, refresh);
    };
  }, []);

  const commitPage = useCallback((from: number, page: FetchedPage): void => {
    setRows((prev) => (from === 0 ? page.rows : [...prev, ...page.rows]));
    setHasMore(page.hasMore);
    setOffset(from + page.rows.length);
  }, []);

  // Disconnected renders the empty state regardless of stale rows, and a
  // reconnect reloads from offset 0 — so no state reset needed. setState only
  // happens in the async continuation (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!connected) return;
    let cancelled = false;
    void fetchPage(0).then((page) => {
      if (!cancelled) commitPage(0, page);
    });
    return () => {
      cancelled = true;
    };
  }, [connected, commitPage]);

  const onLoadMore = async (): Promise<void> => {
    commitPage(offset, await fetchPage(offset));
  };

  if (!connected) {
    return (
      <Card>
        <CardTitle>Out-of-book moments</CardTitle>
        <p style={emptyText(t)}>
          Connect Lichess in <Link to="/settings" style={{ color: t.brand }}>Settings</Link> to
          see when your games leave your prep.
        </p>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card>
        <CardTitle>Out-of-book moments</CardTitle>
        <p style={emptyText(t)}>No out-of-book moments yet. Sync your recent games in Settings.</p>
      </Card>
    );
  }

  return (
    <Card>
      <CardTitle>Out-of-book moments</CardTitle>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rows.map((r) => (
          <button
            key={`${r.gameId}:${r.plyIndex}`}
            onClick={() => navigate(`/lichess/oob/${r.gameId}/${r.plyIndex}`)}
            style={rowStyle(t)}
          >
            <span style={{ color: t.inkSoft, fontSize: 11.5, flexShrink: 0, width: 70 }}>
              {r.dateLabel}
            </span>
            <span style={{ fontWeight: 600, flexShrink: 0, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>
              vs {r.opponent}
            </span>
            <span style={{ color: t.inkSoft, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
              {r.openingName ?? '—'}
            </span>
            <span style={{ fontFamily: fonts.mono, fontSize: 12, flexShrink: 0 }}>
              ply {r.plyIndex + 1}: played <b>{r.playedSAN}</b>, expected {formatExpected(r.expectedSANs)}
            </span>
          </button>
        ))}
      </div>
      {hasMore ? (
        <button onClick={() => void onLoadMore()} style={loadMoreStyle(t)}>
          Load more
        </button>
      ) : null}
    </Card>
  );
}

type FetchedPage = { rows: Row[]; hasMore: boolean };

/** Pure data fetch — over-fetches by one to learn whether a next page exists. */
async function fetchPage(from: number): Promise<FetchedPage> {
  const repo = getLichessRepository();
  const events = await repo.getOOBEvents({ limit: PAGE + 1, offset: from });
  const page = events.slice(0, PAGE);
  const rows = await Promise.all(
    page.map(async (e) => toRow(e, await repo.getGame(e.gameId))),
  );
  return { rows, hasMore: events.length > PAGE };
}

function toRow(e: OOBEvent, game: LichessGame | null): Row {
  const opponent = game
    ? game.userColor === 'white'
      ? game.blackUsername
      : game.whiteUsername
    : '—';
  const dateLabel = game
    ? new Date(game.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : '—';
  return { ...e, opponent, dateLabel };
}

function formatExpected(sans: string[]): string {
  const shown = sans.slice(0, 2).join(', ');
  return sans.length > 2 ? `${shown} +${sans.length - 2} more` : shown;
}

function emptyText(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return { fontSize: 12.5, color: t.inkSoft, fontFamily: fonts.sans, lineHeight: 1.55, margin: 0 };
}

function rowStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 8,
    border: `0.5px solid ${t.border}`,
    background: t.surfaceAlt,
    color: t.ink,
    fontFamily: fonts.sans,
    fontSize: 12.5,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  };
}

function loadMoreStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    marginTop: 8,
    background: 'none',
    border: 'none',
    color: t.brand,
    fontSize: 12.5,
    fontFamily: fonts.sans,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  };
}
