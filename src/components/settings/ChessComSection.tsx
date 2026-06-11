/**
 * ChessComSection — Settings card for chess.com game sync (Phase 3 addendum).
 *
 * No OAuth: chess.com's Published-Data API is public read-only, so the only
 * configuration is a username (public info, plain localStorage). Sync shares
 * the Lichess window, idempotency, and OOB detection pipeline.
 */

import { useState } from 'react';
import { useTokens } from '../../theme/ThemeContext';
import { fonts } from '../../theme/tokens';
import { Card } from '../../ui/primitives/Card';
import { CardTitle } from '../../ui/primitives/CardTitle';
import {
  ChessComUserNotFoundError,
  getChessComUsername,
  setChessComUsername,
} from '../../lib/chesscom/api';
import { syncChessComRecentGames } from '../../lib/lichess/sync';
import { getLichessRepository } from '../../lib/lichess/repository-di';

/** Fired on link/unlink so the Dashboard widget re-evaluates its empty state. */
export const CHESSCOM_CHANGED_EVENT = 'tabiya:chesscom-changed';

type SyncState =
  | { kind: 'idle' }
  | { kind: 'syncing'; synced: number }
  | { kind: 'done'; synced: number; known: number }
  | { kind: 'error'; message: string };

export function ChessComSection() {
  const t = useTokens();
  const [savedUsername, setSavedUsername] = useState<string | null>(getChessComUsername());
  const [draft, setDraft] = useState('');
  const [sync, setSync] = useState<SyncState>({ kind: 'idle' });

  const onLink = (): void => {
    const name = draft.trim();
    if (!name) return;
    setChessComUsername(name);
    setSavedUsername(name);
    setDraft('');
    window.dispatchEvent(new CustomEvent(CHESSCOM_CHANGED_EVENT));
  };

  const onUnlink = async (): Promise<void> => {
    setChessComUsername(null);
    setSavedUsername(null);
    setSync({ kind: 'idle' });
    // Remove this provider's games + their OOB events; Lichess data stays.
    await getLichessRepository().clearSource('chesscom');
    window.dispatchEvent(new CustomEvent(CHESSCOM_CHANGED_EVENT));
  };

  const onSync = async (): Promise<void> => {
    if (!savedUsername) return;
    setSync({ kind: 'syncing', synced: 0 });
    try {
      const result = await syncChessComRecentGames(savedUsername, (p) =>
        setSync({ kind: 'syncing', synced: p.synced }),
      );
      setSync({ kind: 'done', synced: result.synced, known: result.known });
    } catch (err) {
      const message =
        err instanceof ChessComUserNotFoundError
          ? `No chess.com user "${savedUsername}" — check the spelling.`
          : 'chess.com unreachable — check connection.';
      setSync({ kind: 'error', message });
    }
  };

  return (
    <Card>
      <CardTitle>Chess.com</CardTitle>
      <div style={{ fontSize: 12.5, color: t.inkSoft, fontFamily: fonts.sans, marginTop: -6, marginBottom: 12, lineHeight: 1.55 }}>
        Sync your recent chess.com games into the same out-of-book analysis.
        Public games only — no login or password needed, just your username.
      </div>

      {savedUsername === null ? (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            aria-label="chess.com username"
            type="text"
            value={draft}
            placeholder="chess.com username"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onLink();
            }}
            style={inputStyle(t)}
          />
          <button onClick={onLink} disabled={!draft.trim()} style={primaryButton(t)}>
            Link
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 13, color: t.ink, fontFamily: fonts.sans, fontWeight: 600 }}>
              Linked as {savedUsername}
            </span>
            <button onClick={() => void onUnlink()} style={ghostButton(t)}>
              Unlink
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => void onSync()}
              disabled={sync.kind === 'syncing'}
              style={{ ...primaryButton(t), opacity: sync.kind === 'syncing' ? 0.6 : 1 }}
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
          </div>
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
    flexShrink: 0,
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
