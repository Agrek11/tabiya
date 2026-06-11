/**
 * LichessSection — Settings card for Lichess connect / sync / manual import
 * (Phase 3 R1–R3). All network actions are explicit user gestures
 * (Article 11); disconnect wipes token + both IDB stores (R1 AC7).
 */

import { useEffect, useRef, useState } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Card } from '../../ui/primitives/Card';
import { CardTitle } from '../../ui/primitives/CardTitle';
import {
  beginConnect,
  disconnect,
  getStoredToken,
  LICHESS_TOKEN_REJECTED_EVENT,
} from '../../lib/lichess/oauth';
import { syncCooldownRemainingMs, validateGameId } from '../../lib/lichess/api';
import { importGameById, syncRecentGames } from '../../lib/lichess/sync';
import { getLichessRepository } from '../../lib/lichess/repository-di';
import { LichessRateLimitError } from '../../lib/lichess/types';

type SyncState =
  | { kind: 'idle' }
  | { kind: 'syncing'; synced: number }
  | { kind: 'done'; synced: number; known: number }
  | { kind: 'error'; message: string };

type ImportState =
  | { kind: 'idle' }
  | { kind: 'importing' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

export function LichessSection() {
  const t = useTokens();
  const [username, setUsername] = useState<string | null>(getStoredToken()?.username ?? null);
  const [sync, setSync] = useState<SyncState>({ kind: 'idle' });
  const [imp, setImp] = useState<ImportState>({ kind: 'idle' });
  const [gameId, setGameId] = useState('');
  const [cooldownMs, setCooldownMs] = useState(syncCooldownRemainingMs());
  const cooldownTimer = useRef<number | null>(null);

  // Reconnect prompt when any authed call hits a 401 (R1 AC8).
  useEffect(() => {
    const onRejected = (): void => setUsername(null);
    window.addEventListener(LICHESS_TOKEN_REJECTED_EVENT, onRejected);
    return () => window.removeEventListener(LICHESS_TOKEN_REJECTED_EVENT, onRejected);
  }, []);

  // Tick the sync cooldown down while it is active (R2 AC7).
  useEffect(() => {
    if (cooldownMs <= 0) return;
    cooldownTimer.current = window.setTimeout(
      () => setCooldownMs(syncCooldownRemainingMs()),
      1000,
    );
    return () => {
      if (cooldownTimer.current !== null) window.clearTimeout(cooldownTimer.current);
    };
  }, [cooldownMs]);

  const connected = username !== null;

  const onSync = async (): Promise<void> => {
    if (!username) return;
    setSync({ kind: 'syncing', synced: 0 });
    setCooldownMs(60_000);
    try {
      const result = await syncRecentGames(username, (p) =>
        setSync({ kind: 'syncing', synced: p.synced }),
      );
      setSync({ kind: 'done', synced: result.synced, known: result.known });
    } catch (err) {
      const message =
        err instanceof LichessRateLimitError
          ? `Lichess rate limit — try again in ${err.retryAfterSeconds ?? 60}s`
          : 'Lichess unreachable — check connection.';
      setSync({ kind: 'error', message });
    }
  };

  const onImport = async (): Promise<void> => {
    if (!username) return;
    if (!validateGameId(gameId)) {
      setImp({ kind: 'error', message: 'Game ID must be 8 letters/digits' });
      return;
    }
    setImp({ kind: 'importing' });
    try {
      const outcome = await importGameById(gameId, username);
      if (outcome.kind === 'imported') {
        const opp =
          outcome.game.userColor === 'white'
            ? outcome.game.blackUsername
            : outcome.game.whiteUsername;
        setImp({ kind: 'ok', message: `Imported game vs ${opp}` });
        setGameId('');
      } else if (outcome.kind === 'already-imported') {
        setImp({ kind: 'error', message: 'Already imported' });
      } else {
        setImp({ kind: 'error', message: 'Game not found' });
      }
    } catch {
      setImp({ kind: 'error', message: 'Import failed — check connection.' });
    }
  };

  const onDisconnect = async (): Promise<void> => {
    await disconnect();
    await getLichessRepository().clearAll();
    setUsername(null);
    setSync({ kind: 'idle' });
    setImp({ kind: 'idle' });
  };

  return (
    <Card>
      <CardTitle>Lichess</CardTitle>
      <div style={{ fontSize: 12.5, color: t.inkSoft, fontFamily: fonts.sans, marginTop: -6, marginBottom: 12, lineHeight: 1.55 }}>
        Sync your recent games to see where they leave your picked repertoire.
        Read-only access; everything stays in this browser.
      </div>

      {!connected ? (
        <button onClick={() => void beginConnect()} style={primaryButton(t)}>
          Connect Lichess
        </button>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: t.ink, fontFamily: fonts.sans, fontWeight: 600 }}>
              Connected as {username}
            </span>
            <button onClick={() => void onDisconnect()} style={ghostButton(t)}>
              Disconnect
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <button
              onClick={() => void onSync()}
              disabled={sync.kind === 'syncing' || cooldownMs > 0}
              title={cooldownMs > 0 ? `Wait ${Math.ceil(cooldownMs / 1000)}s` : undefined}
              style={{ ...primaryButton(t), opacity: sync.kind === 'syncing' || cooldownMs > 0 ? 0.6 : 1 }}
            >
              {sync.kind === 'syncing' ? `Syncing… ${sync.synced}` : 'Sync now'}
            </button>
            {sync.kind === 'done' ? (
              <span style={{ fontSize: 12, color: t.success }}>
                ✓ Synced {sync.synced} new, {sync.known} already known
              </span>
            ) : null}
            {sync.kind === 'error' ? (
              <span style={{ fontSize: 12, color: t.red }}>✕ {sync.message}</span>
            ) : null}
            {cooldownMs > 0 && sync.kind !== 'syncing' ? (
              <span style={{ fontSize: 11.5, color: t.inkSoft }}>
                next sync in {Math.ceil(cooldownMs / 1000)}s
              </span>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 12 }}>
            <input
              aria-label="Import game by ID"
              type="text"
              value={gameId}
              placeholder="Game ID (8 chars)"
              onChange={(e) => {
                setGameId(e.target.value.trim());
                setImp({ kind: 'idle' });
              }}
              style={inputStyle(t)}
            />
            <button
              onClick={() => void onImport()}
              disabled={imp.kind === 'importing'}
              style={ghostButton(t)}
            >
              {imp.kind === 'importing' ? 'Importing…' : 'Import'}
            </button>
          </div>
          {imp.kind === 'ok' ? (
            <div style={{ fontSize: 12, color: t.success, marginTop: 6 }}>✓ {imp.message}</div>
          ) : null}
          {imp.kind === 'error' ? (
            <div style={{ fontSize: 12, color: t.red, marginTop: 6 }}>✕ {imp.message}</div>
          ) : null}
        </>
      )}
    </Card>
  );
}

function inputStyle(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    flex: 1,
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: `0.5px solid ${t.border}`,
    background: t.surfaceAlt,
    color: t.ink,
    fontFamily: fonts.mono,
    fontSize: 12.5,
  };
}

function primaryButton(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.brand,
    color: t.brandInk,
    border: `0.5px solid ${t.brand}`,
    borderRadius: 999,
    padding: '7px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    fontFamily: fonts.sans,
    cursor: 'pointer',
  };
}

function ghostButton(t: ReturnType<typeof useTokens>): React.CSSProperties {
  return {
    background: t.surfaceAlt,
    color: t.ink,
    border: `0.5px solid ${t.border}`,
    borderRadius: 999,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 500,
    fontFamily: fonts.sans,
    cursor: 'pointer',
    flexShrink: 0,
  };
}
