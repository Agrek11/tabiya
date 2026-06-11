/**
 * Sync + detection orchestration — Phase 3 R2/R3/R5 wiring (design §2, §5).
 *
 * `syncRecentGames` streams games, persists idempotently, and enqueues OOB
 * detection per new game on a serial queue so the progress callback stays
 * responsive. `importGameById` is the single-game manual path sharing the
 * same persistence + detection pipeline (R3 AC4).
 *
 * Detection failure modes (malformed PGN etc.) mark the game checked with a
 * console.warn — they never crash the sync (design failure-modes table).
 */

import { fetchGameById, fetchRecentGames, recordSyncStarted } from './api';
import { AsyncSerialQueue } from './async-serial-queue';
import { detectOOB } from './detect-oob';
import { getLichessRepository } from './repository-di';
import { loadPickedLines } from './picked-lines';
import { getTranspositionIndex } from '../../storage/transpositions';
import type { LichessGame } from './types';
import type { TranspositionSidecar } from '../../types/keySquares';

const detectionQueue = new AsyncSerialQueue();

async function loadIndexOrNull(): Promise<TranspositionSidecar | null> {
  try {
    return await getTranspositionIndex();
  } catch {
    return null; // Phase 2 sidecar missing/stale — linear walk (R6 AC4)
  }
}

async function runDetection(game: LichessGame): Promise<void> {
  const repo = getLichessRepository();
  try {
    const [pickedLines, index] = await Promise.all([loadPickedLines(), loadIndexOrNull()]);
    const event = await detectOOB({ game, pickedLines, transpositionIndex: index });
    if (event) await repo.putOOBEvent(event);
  } catch (err) {
    console.warn(`[lichess] OOB detection failed for game ${game.id}:`, err);
  } finally {
    await repo.markGameChecked(game.id);
  }
}

export interface SyncProgress {
  synced: number;
  known: number;
}

export interface SyncResult extends SyncProgress {
  /** Resolves when all enqueued detections have settled. */
  detectionDone: Promise<void>;
}

/** R2 — bulk sync. `onProgress` fires per streamed game. */
export async function syncRecentGames(
  username: string,
  onProgress?: (p: SyncProgress) => void,
): Promise<SyncResult> {
  recordSyncStarted();
  const repo = getLichessRepository();
  let synced = 0;
  let known = 0;
  for await (const game of fetchRecentGames(username)) {
    const existing = await repo.getGame(game.id);
    if (existing) {
      known++;
    } else {
      await repo.putGame(game);
      void detectionQueue.enqueue(() => runDetection(game));
      synced++;
    }
    onProgress?.({ synced, known });
  }
  return { synced, known, detectionDone: detectionQueue.drain() };
}

export type ImportOutcome =
  | { kind: 'imported'; game: LichessGame }
  | { kind: 'already-imported' }
  | { kind: 'not-found' };

/** R3 — manual import by 8-char game ID. */
export async function importGameById(id: string, username: string): Promise<ImportOutcome> {
  const repo = getLichessRepository();
  if ((await repo.getGame(id)) !== null) return { kind: 'already-imported' }; // R3 AC6, no network
  const game = await fetchGameById(id, username);
  if (game === null) return { kind: 'not-found' };
  await repo.putGame(game);
  void detectionQueue.enqueue(() => runDetection(game));
  return { kind: 'imported', game };
}

/** Test seam — await all pending detections. */
export function __drainDetectionsForTest(): Promise<void> {
  return detectionQueue.drain();
}
