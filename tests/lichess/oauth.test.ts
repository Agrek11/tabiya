/**
 * OAuth PKCE — Phase 3 R8 AC1. Verifier/challenge/state shapes, challenge
 * derivation cross-checked independently, token-exchange request shape, state
 * mismatch rejection, and 401 → token cleared + event dispatched.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  buildTokenExchangeBody,
  generatePkcePair,
  generateState,
  handleCallback,
  onTokenRejected,
  LICHESS_TOKEN_REJECTED_EVENT,
} from '../../src/lib/lichess/oauth';
import { sensitiveStore, LICHESS_TOKEN_KEY } from '../../src/lib/lichess/sensitive-store';
import { LichessAuthError } from '../../src/lib/lichess/types';

const B64URL = /^[A-Za-z0-9_-]+$/;

function b64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('PKCE primitives', () => {
  it('verifier is 43-char base64url; challenge is its SHA-256, independently derived', async () => {
    const { verifier, challenge } = await generatePkcePair();
    expect(verifier).toHaveLength(43); // 32 bytes → 43 base64url chars
    expect(verifier).toMatch(B64URL);
    expect(challenge).toMatch(B64URL);

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
    expect(challenge).toBe(b64url(new Uint8Array(digest)));
  });

  it('state is 22-char base64url and unique per call', () => {
    const a = generateState();
    const b = generateState();
    expect(a).toHaveLength(22); // 16 bytes → 22 base64url chars
    expect(a).toMatch(B64URL);
    expect(a).not.toBe(b);
  });

  it('authorize URL carries S256 + minimum scope + state', () => {
    const url = new URL(buildAuthorizeUrl('CHALLENGE', 'STATE123'));
    expect(url.origin + url.pathname).toBe('https://lichess.org/oauth');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBe('CHALLENGE');
    expect(url.searchParams.get('scope')).toBe('preference:read');
    expect(url.searchParams.get('state')).toBe('STATE123');
    expect(url.searchParams.get('redirect_uri')).toBe(
      `${window.location.origin}/lichess/callback`,
    );
  });

  it('token exchange body has grant_type/code/verifier/redirect_uri/client_id', () => {
    const body = buildTokenExchangeBody('CODE', 'VERIFIER');
    expect(body.get('grant_type')).toBe('authorization_code');
    expect(body.get('code')).toBe('CODE');
    expect(body.get('code_verifier')).toBe('VERIFIER');
    expect(body.get('client_id')).toBe('tabiya-web');
    expect(body.get('redirect_uri')).toBe(`${window.location.origin}/lichess/callback`);
  });
});

describe('handleCallback', () => {
  it('rejects on state mismatch and clears PKCE material', async () => {
    sessionStorage.setItem('tabiya:lichess:oauthState', 'GOOD');
    sessionStorage.setItem('tabiya:lichess:oauthVerifier', 'V');
    await expect(
      handleCallback(new URLSearchParams({ code: 'C', state: 'EVIL' })),
    ).rejects.toThrowError(LichessAuthError);
    expect(sessionStorage.getItem('tabiya:lichess:oauthState')).toBeNull();
    expect(sessionStorage.getItem('tabiya:lichess:oauthVerifier')).toBeNull();
  });

  it('exchanges the code, caches username, persists the token', async () => {
    sessionStorage.setItem('tabiya:lichess:oauthState', 'S');
    sessionStorage.setItem('tabiya:lichess:oauthVerifier', 'V');
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes('/api/token')
        ? new Response(
            JSON.stringify({ access_token: 'tok123', token_type: 'Bearer', expires_in: 100 }),
          )
        : new Response(JSON.stringify({ username: 'abhi' })),
    );
    vi.stubGlobal('fetch', fetchMock);

    const token = await handleCallback(new URLSearchParams({ code: 'C', state: 'S' }));
    expect(token.username).toBe('abhi');
    expect(token.accessToken).toBe('tok123');
    expect(sensitiveStore.get(LICHESS_TOKEN_KEY)).toMatchObject({ username: 'abhi' });
  });
});

describe('401 handling (R1 AC8)', () => {
  it('onTokenRejected clears the stored token and dispatches the event', () => {
    sensitiveStore.set(LICHESS_TOKEN_KEY, { accessToken: 'x' });
    const listener = vi.fn();
    window.addEventListener(LICHESS_TOKEN_REJECTED_EVENT, listener);
    onTokenRejected();
    expect(sensitiveStore.get(LICHESS_TOKEN_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledOnce();
    window.removeEventListener(LICHESS_TOKEN_REJECTED_EVENT, listener);
  });
});
