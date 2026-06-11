/**
 * Sync pipeline — Phase 3 R8 AC2. NDJSON line buffering across chunk
 * boundaries, game mapping, sync idempotency (same response twice = identical
 * store, no duplicate events), rate-limit gate.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LAST_SYNC_AT_KEY,
  mapApiGame,
  streamNdjson,
  syncCooldownRemainingMs,
  validateGameId,
  type LichessApiGame,
} from '../../src/lib/lichess/api';
import { syncRecentGames } from '../../src/lib/lichess/sync';
import { __setLichessRepositoryForTest } from '../../src/lib/lichess/repository-di';
import { sensitiveStore, LICHESS_TOKEN_KEY } from '../../src/lib/lichess/sensitive-store';
import { InMemoryLichessRepository } from './in-memory-repository';

function ndjsonResponse(lines: string[], chunkSize: number): Response {
  const text = lines.join('\n');
  const encoded = new TextEncoder().encode(text);
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      // Deliberately split at arbitrary byte offsets to exercise buffering.
      for (let i = 0; i < encoded.length; i += chunkSize) {
        controller.enqueue(encoded.slice(i, i + chunkSize));
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'application/x-ndjson' } });
}

const API_GAME = (id: string): LichessApiGame => ({
  id,
  createdAt: 1_000,
  players: { white: { user: { name: 'Abhi' } }, black: { user: { name: 'Rival' } } },
  winner: 'white',
  status: 'mate',
  pgn: '1. e4 e5 *',
  opening: { eco: 'C20', name: "King's Pawn Game", ply: 2 },
});

describe('streamNdjson', () => {
  it('parses lines split across arbitrary chunk boundaries', async () => {
    const lines = [JSON.stringify({ a: 1 }), JSON.stringify({ a: 2 }), JSON.stringify({ a: 3 })];
    for (const chunkSize of [1, 3, 7, 1000]) {
      const got: Array<{ a: number }> = [];
      for await (const obj of streamNdjson<{ a: number }>(ndjsonResponse(lines, chunkSize))) {
        got.push(obj);
      }
      expect(got.map((o) => o.a)).toEqual([1, 2, 3]);
    }
  });
});

describe('mapApiGame', () => {
  it('maps user color case-insensitively and the result from winner', () => {
    const game = mapApiGame(API_GAME('aaaa1111'), 'abhi');
    expect(game.userColor).toBe('white');
    expect(game.result).toBe('1-0');
    expect(game.opening?.eco).toBe('C20');
    expect(game.oobChecked).toBe(false);
  });

  it('handles AI + anonymous opponents and drawn/no-winner statuses', () => {
    const vsAi: LichessApiGame = {
      ...API_GAME('bbbb2222'),
      players: { white: { user: { name: 'Abhi' } }, black: { aiLevel: 3 } },
      winner: undefined,
      status: 'draw',
    };
    const game = mapApiGame(vsAi, 'Abhi');
    expect(game.blackUsername).toBe('Stockfish level 3');
    expect(game.result).toBe('1/2-1/2');
  });
});

describe('syncRecentGames idempotency (R8 AC2)', () => {
  let repo: InMemoryLichessRepository;

  beforeEach(() => {
    localStorage.clear();
    repo = new InMemoryLichessRepository();
    __setLichessRepositoryForTest(repo);
    sensitiveStore.set(LICHESS_TOKEN_KEY, {
      accessToken: 'tok',
      tokenType: 'Bearer',
      scope: 'preference:read',
      obtainedAt: 0,
      expiresAt: null,
      username: 'Abhi',
    });
    const lines = [JSON.stringify(API_GAME('aaaa1111')), JSON.stringify(API_GAME('bbbb2222'))];
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ndjsonResponse(lines, 16)),
    );
  });

  afterEach(() => {
    __setLichessRepositoryForTest(null);
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('same response twice → identical store contents, no duplicate OOB events', async () => {
    const first = await syncRecentGames('Abhi');
    expect(first.synced).toBe(2);
    expect(first.known).toBe(0);
    await first.detectionDone;
    const gamesAfterFirst = await repo.listGames();
    const eventsAfterFirst = await repo.getOOBEvents();

    const second = await syncRecentGames('Abhi');
    expect(second.synced).toBe(0);
    expect(second.known).toBe(2);
    await second.detectionDone;

    expect(await repo.listGames()).toEqual(gamesAfterFirst);
    expect(await repo.getOOBEvents()).toEqual(eventsAfterFirst);
  });

  it('progress callback fires per streamed game', async () => {
    const seen: number[] = [];
    const result = await syncRecentGames('Abhi', (p) => seen.push(p.synced + p.known));
    await result.detectionDone;
    expect(seen).toEqual([1, 2]);
  });
});

describe('rate limit gate (R2 AC7)', () => {
  it('cooldown counts down from the recorded sync start', () => {
    localStorage.setItem(LAST_SYNC_AT_KEY, String(10_000));
    expect(syncCooldownRemainingMs(10_000)).toBe(60_000);
    expect(syncCooldownRemainingMs(40_000)).toBe(30_000);
    expect(syncCooldownRemainingMs(80_000)).toBe(0);
  });
});

describe('validateGameId (R3 AC2)', () => {
  it('accepts 8-char base62, rejects everything else', () => {
    expect(validateGameId('abCD1234')).toBe(true);
    expect(validateGameId('abc123')).toBe(false);
    expect(validateGameId('abCD12345')).toBe(false);
    expect(validateGameId('abCD12!4')).toBe(false);
  });
});
