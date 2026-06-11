/**
 * /lichess/callback — OAuth landing page (Phase 3 R1).
 *
 * Validates the state round-trip + exchanges the code via `handleCallback`,
 * then routes back to Settings. Failure shows a retry-able error; PKCE
 * material in sessionStorage is cleared in every path by the handler.
 */

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTokens } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';
import { handleCallback } from '../lib/lichess/oauth';

type State = { kind: 'working' } | { kind: 'error' };

export function LichessCallbackPage() {
  const t = useTokens();
  const navigate = useNavigate();
  const [state, setState] = useState<State>({ kind: 'working' });
  const ran = useRef(false); // StrictMode double-invoke guard — exchange is one-shot

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    void (async () => {
      try {
        await handleCallback(new URLSearchParams(window.location.search));
        navigate('/settings', { replace: true });
      } catch {
        setState({ kind: 'error' });
      }
    })();
  }, [navigate]);

  return (
    <div style={{ padding: 40, textAlign: 'center', fontFamily: fonts.sans, color: t.ink }}>
      {state.kind === 'working' ? (
        <p>Connecting to Lichess…</p>
      ) : (
        <>
          <p style={{ color: t.red }}>Authorization failed — try again.</p>
          <button
            onClick={() => navigate('/settings', { replace: true })}
            style={{
              background: t.brand,
              color: t.brandInk,
              border: 'none',
              borderRadius: 999,
              padding: '8px 16px',
              fontSize: 13,
              fontFamily: fonts.sans,
              cursor: 'pointer',
            }}
          >
            Back to Settings
          </button>
        </>
      )}
    </div>
  );
}
