/**
 * In-memory LichessRepository — test double proving the interface is
 * implementation-agnostic (R8 AC5). Mirrors the IDB impl's semantics.
 */

import type { LichessRepository } from '../../src/lib/lichess/repository';
import type { LichessGame, OOBEvent } from '../../src/lib/lichess/types';

export class InMemoryLichessRepository implements LichessRepository {
  private games = new Map<string, LichessGame>();
  private events = new Map<string, OOBEvent>();

  async getGame(gameId: string): Promise<LichessGame | null> {
    return this.games.get(gameId) ?? null;
  }

  async putGame(game: LichessGame): Promise<void> {
    const existing = this.games.get(game.id);
    if (existing && existing.importedAt >= game.importedAt) return;
    this.games.set(game.id, game);
  }

  async listGames(opts: { since?: number; limit?: number } = {}): Promise<LichessGame[]> {
    let all = [...this.games.values()];
    if (opts.since !== undefined) all = all.filter((g) => g.createdAt >= opts.since!);
    all.sort((a, b) => b.createdAt - a.createdAt);
    return opts.limit !== undefined ? all.slice(0, opts.limit) : all;
  }

  async markGameChecked(gameId: string): Promise<void> {
    const game = this.games.get(gameId);
    if (game) this.games.set(gameId, { ...game, oobChecked: true });
  }

  async getOOBEvents(
    opts: { limit?: number; offset?: number; gameId?: string } = {},
  ): Promise<OOBEvent[]> {
    let events = [...this.events.values()];
    if (opts.gameId !== undefined) events = events.filter((e) => e.gameId === opts.gameId);
    events.sort((a, b) => b.detectedAt - a.detectedAt);
    const start = opts.offset ?? 0;
    const end = opts.limit !== undefined ? start + opts.limit : undefined;
    return events.slice(start, end);
  }

  async putOOBEvent(event: OOBEvent): Promise<void> {
    this.events.set(`${event.gameId}::${event.plyIndex}`, event);
  }

  async clearAll(): Promise<void> {
    this.games.clear();
    this.events.clear();
  }
}
