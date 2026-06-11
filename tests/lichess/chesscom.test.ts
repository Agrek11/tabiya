/**
 * Chess.com integration — mapping, archive windowing, ECO-from-PGN, sync
 * through the shared ingest pipeline (idempotency + detection reuse).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveUrlsForWindow,
  fetchChessComProfile,
  mapChessComGame,
  openingFromPgn,
  type ChessComApiGame,
} from '../../src/lib/chesscom/api';
import { syncChessComRecentGames } from '../../src/lib/lichess/sync';
import { __setLichessRepositoryForTest } from '../../src/lib/lichess/repository-di';
import { InMemoryLichessRepository } from './in-memory-repository';

const NOW_S = Math.floor(Date.now() / 1000);

const PGN = `[Event "Live Chess"]
[ECO "C50"]
[ECOUrl "https://www.chess.com/openings/Italian-Game-Giuoco-Pianissimo"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. d3 Nf6 *`;

function apiGame(over: Partial<ChessComApiGame> = {}): ChessComApiGame {
  return {
    url: 'https://www.chess.com/game/live/123456789',
    pgn: PGN,
    uuid: 'uuid-0001',
    end_time: NOW_S - 3600,
    rules: 'chess',
    white: { username: 'Agrek11', result: 'win' },
    black: { username: 'Rival', result: 'checkmated' },
    ...over,
  };
}

describe('mapChessComGame', () => {
  it('maps color case-insensitively, result from per-side codes, opening from PGN', () => {
    const game = mapChessComGame(apiGame(), 'agrek11');
    expect(game.source).toBe('chesscom');
    expect(game.userColor).toBe('white');
    expect(game.result).toBe('1-0');
    expect(game.opening).toEqual({ eco: 'C50', name: 'Italian Game Giuoco Pianissimo', ply: 0 });
    expect(game.url).toBe('https://www.chess.com/game/live/123456789');
    expect(game.createdAt).toBe((NOW_S - 3600) * 1000);
  });

  it('maps draws and black wins', () => {
    expect(
      mapChessComGame(
        apiGame({ white: { username: 'Agrek11', result: 'agreed' }, black: { username: 'Rival', result: 'agreed' } }),
        'Agrek11',
      ).result,
    ).toBe('1/2-1/2');
    expect(
      mapChessComGame(
        apiGame({ white: { username: 'Rival', result: 'timeout' }, black: { username: 'Agrek11', result: 'win' } }),
        'Agrek11',
      ),
    ).toMatchObject({ result: '0-1', userColor: 'black' });
  });
});

describe('openingFromPgn', () => {
  it('returns null without an ECO header; falls back to the code without ECOUrl', () => {
    expect(openingFromPgn('1. e4 e5 *')).toBeNull();
    expect(openingFromPgn('[ECO "B12"]\n\n1. e4 c6 *')).toEqual({ eco: 'B12', name: 'B12', ply: 0 });
  });
});

describe('archiveUrlsForWindow', () => {
  it('keeps only months that can overlap the window', () => {
    const archives = [
      'https://api.chess.com/pub/player/x/games/2026/03',
      'https://api.chess.com/pub/player/x/games/2026/05',
      'https://api.chess.com/pub/player/x/games/2026/06',
    ];
    const sinceMs = Date.UTC(2026, 4, 28); // 2026-05-28 → keep May + June
    expect(archiveUrlsForWindow(archives, sinceMs)).toEqual([archives[1], archives[2]]);
  });
});

describe('syncChessComRecentGames', () => {
  let repo: InMemoryLichessRepository;

  beforeEach(() => {
    repo = new InMemoryLichessRepository();
    __setLichessRepositoryForTest(repo);
    const archivesUrl = /\/games\/archives$/;
    const monthUrl = (y: number, m: string) =>
      `https://api.chess.com/pub/player/agrek11/games/${y}/${m}`;
    const now = new Date();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: RequestInfo | URL) => {
        if (archivesUrl.test(String(url))) {
          return new Response(JSON.stringify({ archives: [monthUrl(now.getUTCFullYear(), month)] }));
        }
        return new Response(
          JSON.stringify({
            games: [
              apiGame({ uuid: 'uuid-1' }),
              apiGame({ uuid: 'uuid-2', rules: 'chess960' }), // skipped: variant
              apiGame({ uuid: 'uuid-3', end_time: NOW_S - 20 * 24 * 3600 }), // skipped: too old
            ],
          }),
        );
      }),
    );
  });

  afterEach(() => {
    __setLichessRepositoryForTest(null);
    vi.unstubAllGlobals();
  });

  it('ingests window-filtered standard games; second run is all-known', async () => {
    const first = await syncChessComRecentGames('agrek11');
    await first.detectionDone;
    expect(first.synced).toBe(1);
    expect((await repo.listGames()).map((g) => g.id)).toEqual(['uuid-1']);

    const second = await syncChessComRecentGames('agrek11');
    await second.detectionDone;
    expect(second).toMatchObject({ synced: 0, known: 1 });
  });
});

describe('fetchChessComProfile (link confirmation)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns the canonical profile for a known user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            username: 'Agrek11',
            name: 'Abhishek',
            avatar: 'https://images.chesscomfiles.com/x.png',
            joined: 1_600_000_000,
            extra_field_ignored: true,
          }),
        ),
      ),
    );
    expect(await fetchChessComProfile('agrek11')).toEqual({
      username: 'Agrek11',
      name: 'Abhishek',
      avatar: 'https://images.chesscomfiles.com/x.png',
      joined: 1_600_000_000,
    });
  });

  it('returns null on 404 (typo path)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    expect(await fetchChessComProfile('nosuchuserxyz')).toBeNull();
  });
});

describe('clearSource', () => {
  it('removes only the named provider games + their events', async () => {
    const repo = new InMemoryLichessRepository();
    await repo.putGame({ ...mapChessComGame(apiGame(), 'Agrek11'), id: 'cc-1' });
    await repo.putGame({
      ...mapChessComGame(apiGame(), 'Agrek11'),
      id: 'li-1',
      source: undefined, // legacy lichess row
    });
    await repo.putOOBEvent({
      gameId: 'cc-1', plyIndex: 2, playedSAN: 'c3', expectedSANs: ['d3'], color: 'white',
      fenAtOOB: 'x', openingEco: null, openingName: null, lineId: null, detectedAt: 1,
    });
    await repo.putOOBEvent({
      gameId: 'li-1', plyIndex: 2, playedSAN: 'c3', expectedSANs: ['d3'], color: 'white',
      fenAtOOB: 'x', openingEco: null, openingName: null, lineId: null, detectedAt: 2,
    });

    await repo.clearSource('chesscom');
    expect((await repo.listGames()).map((g) => g.id)).toEqual(['li-1']);
    expect((await repo.getOOBEvents()).map((e) => e.gameId)).toEqual(['li-1']);
  });
});
