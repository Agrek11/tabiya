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
  fetchChessComProfile,
  getChessComUsername,
  setChessComUsername,
  type ChessComProfile,
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

/** Link flow: type a name → look it up → confirm the profile is really you. */
type LinkState =
  | { kind: 'idle' }
  | { kind: 'looking' }
  | { kind: 'confirm'; profile: ChessComProfile }
  | { kind: 'error'; message: string };

export function ChessComSection() {
  const t = useTokens();
  const [savedUsername, setSavedUsername] = useState<string | null>(getChessComUsername());
  const [draft, setDraft] = useState('');
  const [link, setLink] = useState<LinkState>({ kind: 'idle' });
  const [sync, setSync] = useState<SyncState>({ kind: 'idle' });

  // Step 1 — look the username up; typos surface instantly as "not found".
  const onLookup = async (): Promise<void> => {
    const name = draft.trim();
    if (!name) return;
    setLink({ kind: 'looking' });
    try {
      const profile = await fetchChessComProfile(name);
      if (profile === null) {
        setLink({
          kind: 'error',
          message: `No chess.com user "${name}". Your username is shown top-right on chess.com.`,
        });
        return;
      }
      setLink({ kind: 'confirm', profile });
    } catch {
      setLink({ kind: 'error', message: 'chess.com unreachable — check connection.' });
    }
  };

  // Step 2 — user confirmed the looked-up profile is theirs.
  const onConfirm = (profile: ChessComProfile): void => {
    setChessComUsername(profile.username); // canonical capitalization
    setSavedUsername(profile.username);
    setDraft('');
    setLink({ kind: 'idle' });
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
        <>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              aria-label="chess.com username"
              type="text"
              value={draft}
              placeholder="chess.com username"
              onChange={(e) => {
                setDraft(e.target.value);
                setLink({ kind: 'idle' });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void onLookup();
              }}
              style={inputStyle(t)}
            />
            <button
              onClick={() => void onLookup()}
              disabled={!draft.trim() || link.kind === 'looking'}
              style={primaryButton(t)}
            >
              {link.kind === 'looking' ? 'Looking…' : 'Find'}
            </button>
          </div>
          <div style={{ fontSize: 11, color: t.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
            Forgot it? It's shown top-right when you're logged in at chess.com.
          </div>
          {link.kind === 'error' ? (
            <div style={{ fontSize: 12, color: t.red, marginTop: 8 }}>✕ {link.message}</div>
          ) : null}
          {link.kind === 'confirm' ? (
            <div
              data-testid="chesscom-confirm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginTop: 10,
                padding: '10px 12px',
                borderRadius: 10,
                border: `0.5px solid ${t.border}`,
                background: t.surfaceAlt,
              }}
            >
              {link.profile.avatar ? (
                <img
                  src={link.profile.avatar}
                  alt=""
                  style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }}
                />
              ) : null}
              <div style={{ flex: 1, fontSize: 12.5, fontFamily: fonts.sans, color: t.ink, lineHeight: 1.5 }}>
                <b>{link.profile.username}</b>
                {link.profile.name ? <span style={{ color: t.inkSoft }}> · {link.profile.name}</span> : null}
                <div style={{ color: t.inkSoft, fontSize: 11.5 }}>
                  member since {new Date(link.profile.joined * 1000).getFullYear()}
                </div>
              </div>
              <button onClick={() => onConfirm(link.profile)} style={primaryButton(t)}>
                Yes, that's me
              </button>
              <button onClick={() => setLink({ kind: 'idle' })} style={ghostButton(t)}>
                No
              </button>
            </div>
          ) : null}
        </>
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
