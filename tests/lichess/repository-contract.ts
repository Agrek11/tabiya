/**
 * Reusable LichessRepository contract suite — Phase 3 R8 AC5 (Article 5).
 * Any implementation (IDB, in-memory, future backend-served) passes the same
 * guarantees. Not a test file itself.
 */

import { describe, expect, it } from 'vitest';
import type { LichessRepository } from '../../src/lib/lichess/repository';
import type { LichessGame, OOBEvent } from '../../src/lib/lichess/types';

export function makeGame(over: Partial<LichessGame> = {}): LichessGame {
  return {
    id: 'abcd1234',
    createdAt: 1_000,
    whiteUsername: 'me',
    blackUsername: 'them',
    userColor: 'white',
    result: '1-0',
    pgn: '1. e4 e5 *',
    opening: { eco: 'C20', name: "King's Pawn", ply: 2 },
    importedAt: 1_000,
    oobChecked: false,
    ...over,
  };
}

export function makeEvent(over: Partial<OOBEvent> = {}): OOBEvent {
  return {
    gameId: 'abcd1234',
    plyIndex: 4,
    playedSAN: 'c3',
    expectedSANs: ['d3'],
    color: 'white',
    fenAtOOB: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    openingEco: 'C50',
    openingName: 'Italian Game',
    lineId: 'italian-main',
    detectedAt: 1_000,
    ...over,
  };
}

export function runLichessRepositoryContract(
  label: string,
  factory: () => Promise<LichessRepository> | LichessRepository,
): void {
  describe(`LichessRepository contract — ${label}`, () => {
    it('getGame returns null for unknown id; putGame then getGame roundtrips', async () => {
      const repo = await factory();
      expect(await repo.getGame('zzzzzzzz')).toBeNull();
      const game = makeGame();
      await repo.putGame(game);
      expect(await repo.getGame(game.id)).toEqual(game);
    });

    it('putGame is idempotent — older/equal importedAt never overwrites (R4 AC6)', async () => {
      const repo = await factory();
      await repo.putGame(makeGame({ importedAt: 2_000, result: '1-0' }));
      await repo.putGame(makeGame({ importedAt: 1_000, result: '0-1' })); // older — no-op
      expect((await repo.getGame('abcd1234'))!.result).toBe('1-0');
      await repo.putGame(makeGame({ importedAt: 3_000, result: '1/2-1/2' })); // newer — wins
      expect((await repo.getGame('abcd1234'))!.result).toBe('1/2-1/2');
    });

    it('listGames orders most-recent-first and honors since/limit', async () => {
      const repo = await factory();
      await repo.putGame(makeGame({ id: 'aaaaaaaa', createdAt: 100 }));
      await repo.putGame(makeGame({ id: 'bbbbbbbb', createdAt: 300 }));
      await repo.putGame(makeGame({ id: 'cccccccc', createdAt: 200 }));
      const all = await repo.listGames();
      expect(all.map((g) => g.id)).toEqual(['bbbbbbbb', 'cccccccc', 'aaaaaaaa']);
      expect((await repo.listGames({ since: 150 })).map((g) => g.id)).toEqual([
        'bbbbbbbb',
        'cccccccc',
      ]);
      expect((await repo.listGames({ limit: 1 })).map((g) => g.id)).toEqual(['bbbbbbbb']);
    });

    it('markGameChecked flips oobChecked and tolerates unknown ids', async () => {
      const repo = await factory();
      await repo.putGame(makeGame());
      await repo.markGameChecked('abcd1234');
      expect((await repo.getGame('abcd1234'))!.oobChecked).toBe(true);
      await expect(repo.markGameChecked('zzzzzzzz')).resolves.toBeUndefined();
    });

    it('putOOBEvent upserts by [gameId, plyIndex]; getOOBEvents filters + paginates', async () => {
      const repo = await factory();
      await repo.putOOBEvent(makeEvent({ plyIndex: 4, detectedAt: 100 }));
      await repo.putOOBEvent(makeEvent({ plyIndex: 4, detectedAt: 150, playedSAN: 'c4' })); // upsert
      await repo.putOOBEvent(makeEvent({ plyIndex: 8, detectedAt: 200 }));
      await repo.putOOBEvent(makeEvent({ gameId: 'other001', plyIndex: 2, detectedAt: 300 }));

      const all = await repo.getOOBEvents();
      expect(all).toHaveLength(3); // upsert did not duplicate
      expect(all.map((e) => e.detectedAt)).toEqual([300, 200, 150]); // recent first
      expect(all[2]!.playedSAN).toBe('c4'); // upsert overwrote

      expect(await repo.getOOBEvents({ gameId: 'abcd1234' })).toHaveLength(2);
      expect(await repo.getOOBEvents({ limit: 1, offset: 1 })).toHaveLength(1);
      expect((await repo.getOOBEvents({ limit: 1, offset: 1 }))[0]!.detectedAt).toBe(200);
    });

    it('clearAll wipes both stores (R1 AC7 disconnect path)', async () => {
      const repo = await factory();
      await repo.putGame(makeGame());
      await repo.putOOBEvent(makeEvent());
      await repo.clearAll();
      expect(await repo.listGames()).toHaveLength(0);
      expect(await repo.getOOBEvents()).toHaveLength(0);
    });
  });
}
