/**
 * Lichess OAuth2 PKCE — Phase 3 R1.
 *
 * Browser-native only: `crypto.getRandomValues` + `crypto.subtle.digest` +
 * `fetch`. No auth SDK (R1 AC9, Articles 1 + 3). Lichess public clients use
 * PKCE as proof-of-possession — no client secret exists anywhere.
 *
 * Flow:
 *   beginConnect()           — generate verifier/challenge/state, stash in
 *                              sessionStorage, full-page navigate to Lichess
 *   handleCallback(params)   — validate state, exchange code+verifier for a
 *                              token, cache username, persist StoredToken
 *   disconnect()             — best-effort revoke + clear ALL local state
 */

import { LICHESS, LICHESS_SCOPES, LichessAuthError, type StoredToken } from './types';
import { sensitiveStore, LICHESS_TOKEN_KEY } from './sensitive-store';

const SS_VERIFIER = 'tabiya:lichess:oauthVerifier';
const SS_STATE = 'tabiya:lichess:oauthState';

/** Window event names — UI listens to re-render on auth changes. */
export const LICHESS_CONNECTED_EVENT = 'tabiya:lichess-connected';
export const LICHESS_DISCONNECTED_EVENT = 'tabiya:lichess-disconnected';
export const LICHESS_TOKEN_REJECTED_EVENT = 'tabiya:lichess-token-rejected';

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** RFC 7636 pair: 43-char base64url verifier, SHA-256 base64url challenge. */
export async function generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const verifier = base64UrlEncode(bytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(new Uint8Array(digest));
  return { verifier, challenge };
}

/** CSRF state parameter — 22-char base64url. */
export function generateState(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
}

/**
 * Redirect URI resolution (design §1). `LICHESS_OAUTH_ORIGIN` is an optional
 * index.html shim the Docker image substitutes at container start
 * (Article 16); otherwise the live origin works for dev + static deploys.
 */
export function resolveRedirectUri(): string {
  const shim = (window as { LICHESS_OAUTH_ORIGIN?: string }).LICHESS_OAUTH_ORIGIN;
  const origin = shim ?? window.location.origin;
  return `${origin}/lichess/callback`;
}

/** Compose the authorize URL for a generated PKCE pair + state. */
export function buildAuthorizeUrl(challenge: string, state: string): string {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: LICHESS.clientId,
    redirect_uri: resolveRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    scope: LICHESS_SCOPES.join(' '),
    state,
  });
  return `${LICHESS.authorizeUrl}?${params.toString()}`;
}

/** Step 1 — stash PKCE material and navigate to Lichess consent page. */
export async function beginConnect(): Promise<void> {
  const { verifier, challenge } = await generatePkcePair();
  const state = generateState();
  sessionStorage.setItem(SS_VERIFIER, verifier);
  sessionStorage.setItem(SS_STATE, state);
  window.location.assign(buildAuthorizeUrl(challenge, state));
}

/** Token-exchange request body — exported shape for tests (R8 AC1). */
export function buildTokenExchangeBody(code: string, verifier: string): URLSearchParams {
  return new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    code_verifier: verifier,
    redirect_uri: resolveRedirectUri(),
    client_id: LICHESS.clientId,
  });
}

/**
 * Step 2 — callback handler. Validates state round-trip, exchanges the code,
 * caches the username from /api/account, persists the StoredToken.
 * Throws LichessAuthError on any failure; sessionStorage PKCE material is
 * cleared in every path.
 */
export async function handleCallback(params: URLSearchParams): Promise<StoredToken> {
  const code = params.get('code');
  const returnedState = params.get('state');
  const storedState = sessionStorage.getItem(SS_STATE);
  const verifier = sessionStorage.getItem(SS_VERIFIER);
  sessionStorage.removeItem(SS_STATE);
  sessionStorage.removeItem(SS_VERIFIER);

  if (!code || !verifier || !storedState || returnedState !== storedState) {
    throw new LichessAuthError('state_mismatch');
  }

  const res = await fetch(LICHESS.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildTokenExchangeBody(code, verifier),
  });
  if (!res.ok) throw new LichessAuthError('exchange_failed');
  const json = (await res.json()) as {
    access_token: string;
    token_type: string;
    expires_in?: number;
    scope?: string;
  };

  // Cache the username immediately — sync needs it and /api/account is the
  // only authoritative source (continuation of the consent gesture).
  const acct = await fetch(LICHESS.accountUrl, {
    headers: { Authorization: `Bearer ${json.access_token}` },
  });
  if (!acct.ok) throw new LichessAuthError('exchange_failed');
  const { username } = (await acct.json()) as { username: string };

  const token: StoredToken = {
    accessToken: json.access_token,
    tokenType: 'Bearer',
    scope: json.scope ?? LICHESS_SCOPES.join(' '),
    obtainedAt: Date.now(),
    expiresAt: json.expires_in ? Date.now() + json.expires_in * 1000 : null,
    username,
  };
  sensitiveStore.set(LICHESS_TOKEN_KEY, token);
  window.dispatchEvent(new CustomEvent(LICHESS_CONNECTED_EVENT));
  return token;
}

export function getStoredToken(): StoredToken | null {
  return sensitiveStore.get<StoredToken>(LICHESS_TOKEN_KEY);
}

export function isConnected(): boolean {
  return getStoredToken() !== null;
}

/**
 * Disconnect — best-effort server revoke, then unconditional local cleanup
 * (R1 AC7). Revoke failure never blocks cleanup (design §1).
 * Repository wipe is the caller's job (it owns the DI seam) — see
 * LichessSection, which calls `getLichessRepository().clearAll()` after this.
 */
export async function disconnect(): Promise<void> {
  const token = getStoredToken();
  if (token) {
    try {
      await fetch(LICHESS.tokenUrl, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token.accessToken}` },
      });
    } catch {
      /* network down — local cleanup proceeds regardless */
    }
  }
  sensitiveStore.clear(LICHESS_TOKEN_KEY);
  sessionStorage.removeItem(SS_VERIFIER);
  sessionStorage.removeItem(SS_STATE);
  window.dispatchEvent(new CustomEvent(LICHESS_DISCONNECTED_EVENT));
}

/** 401 handling shared by every authed call (R1 AC8). */
export function onTokenRejected(): void {
  sensitiveStore.clear(LICHESS_TOKEN_KEY);
  window.dispatchEvent(new CustomEvent(LICHESS_TOKEN_REJECTED_EVENT));
}
