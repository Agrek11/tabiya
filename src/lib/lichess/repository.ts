/**
 * LichessRepository — the Article 5 seam for all Lichess persistence (R4).
 *
 * Consumers (Settings section, OOB widget, viewer, detector pipeline) import
 * ONLY this interface + the DI accessor. The IDB impl is swappable — the
 * contract test suite (tests/lichess/repository-contract.ts) runs against any
 * implementation, so a future backend-served swap is a single DI edit.
 */

import type { LichessGame, OOBEvent } from './types';

export interface LichessRepository {
  getGame(gameId: string): Promise<LichessGame | null>;
  /** Idempotent: overwrites only if `importedAt` is newer (R4 AC6). */
  putGame(game: LichessGame): Promise<void>;
  /** Most recent first. */
  listGames(opts?: { since?: number; limit?: number }): Promise<LichessGame[]>;
  markGameChecked(gameId: string): Promise<void>;
  /** Most recently detected first. */
  getOOBEvents(opts?: { limit?: number; offset?: number; gameId?: string }): Promise<OOBEvent[]>;
  /** Upsert by composite key [gameId, plyIndex] — naturally idempotent. */
  putOOBEvent(event: OOBEvent): Promise<void>;
  /** Wipes BOTH stores — used by Disconnect (R1 AC7). */
  clearAll(): Promise<void>;
}
