/**
 * Tests for JsonOpeningRepository.
 *
 * fetch is mocked via vitest's vi.fn — no live network access.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JsonOpeningRepository } from '../src/storage/JsonOpeningRepository';
import type { Catalog } from '../src/storage/types';

const SAMPLE: Catalog = {
  version: '2026-05-03',
  openings: [
    {
      id: 'ruy-lopez',
      name: 'Ruy Lopez',
      eco: 'C60-C99',
      color: 'black',
      line_ids: ['ruy-lopez-main'],
    },
    {
      id: 'italian-game',
      name: 'Italian Game',
      eco: 'C50-C59',
      color: 'black',
      line_ids: ['italian-game-main'],
    },
    {
      id: 'queens-gambit',
      name: "Queen's Gambit",
      eco: 'D06-D69',
      color: 'white',
      line_ids: ['queens-gambit-main'],
    },
  ],
  lines: [
    {
      id: 'ruy-lopez-main',
      opening_id: 'ruy-lopez',
      name: 'Main Line',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
      depth: 5,
      end_fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
      popularity: 0.42,
      tags: ['classical', 'main-line'],
      strategic_notes: [],
      key_squares: [],
    },
    {
      id: 'italian-game-main',
      opening_id: 'italian-game',
      name: 'Main Line',
      moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
      depth: 5,
      end_fen: '...',
      popularity: 0.35,
      tags: ['classical'],
      strategic_notes: [],
      key_squares: [],
    },
    {
      id: 'queens-gambit-main',
      opening_id: 'queens-gambit',
      name: 'Main Line',
      moves: ['d4', 'd5', 'c4'],
      depth: 3,
      end_fen: '...',
      popularity: 0.5,
      tags: ['classical', 'main-line'],
      strategic_notes: [],
      key_squares: [],
    },
  ],
};

function mockFetchSuccess(payload: unknown): void {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve(payload),
      status: 200,
    } as Response)
  );
}

function mockFetchHttpError(status: number): void {
  globalThis.fetch = vi.fn(() =>
    Promise.resolve({ ok: false, json: () => Promise.resolve(null), status } as Response)
  );
}

function mockFetchReject(err: Error): void {
  globalThis.fetch = vi.fn(() => Promise.reject(err));
}

describe('JsonOpeningRepository', () => {
  let repo: JsonOpeningRepository;

  beforeEach(() => {
    repo = new JsonOpeningRepository('/test-catalog.json');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Successful loads
  // -------------------------------------------------------------------------

  it('listOpenings returns all openings', async () => {
    mockFetchSuccess(SAMPLE);
    const result = await repo.listOpenings();
    expect(result).toHaveLength(3);
    expect(result[0]!.id).toBe('ruy-lopez');
  });

  it('getOpening returns the matching opening', async () => {
    mockFetchSuccess(SAMPLE);
    const result = await repo.getOpening('italian-game');
    expect(result?.name).toBe('Italian Game');
  });

  it('getOpening returns null for unknown id', async () => {
    mockFetchSuccess(SAMPLE);
    expect(await repo.getOpening('does-not-exist')).toBeNull();
  });

  it('listLines filters by opening_id', async () => {
    mockFetchSuccess(SAMPLE);
    const lines = await repo.listLines('ruy-lopez');
    expect(lines).toHaveLength(1);
    expect(lines[0]!.id).toBe('ruy-lopez-main');
  });

  it('listLines returns empty list for unknown opening', async () => {
    mockFetchSuccess(SAMPLE);
    expect(await repo.listLines('nope')).toEqual([]);
  });

  it('getLine returns the matching line', async () => {
    mockFetchSuccess(SAMPLE);
    const line = await repo.getLine('queens-gambit-main');
    expect(line?.moves).toEqual(['d4', 'd5', 'c4']);
  });

  it('getLine returns null for unknown id', async () => {
    mockFetchSuccess(SAMPLE);
    expect(await repo.getLine('nope')).toBeNull();
  });

  // -------------------------------------------------------------------------
  // searchLines filters
  // -------------------------------------------------------------------------

  describe('searchLines', () => {
    it('filters by color via the parent opening', async () => {
      mockFetchSuccess(SAMPLE);
      const whites = await repo.searchLines({ color: 'white' });
      expect(whites).toHaveLength(1);
      expect(whites[0]!.opening_id).toBe('queens-gambit');
    });

    it('filters by eco substring', async () => {
      mockFetchSuccess(SAMPLE);
      const cs = await repo.searchLines({ eco: 'C60' });
      expect(cs).toHaveLength(1);
      expect(cs[0]!.id).toBe('ruy-lopez-main');
    });

    it('filters by tags (all required)', async () => {
      mockFetchSuccess(SAMPLE);
      const main = await repo.searchLines({ tags: ['main-line'] });
      expect(main.map((l) => l.id).sort()).toEqual(['queens-gambit-main', 'ruy-lopez-main']);
    });

    it('returns all lines when query is empty', async () => {
      mockFetchSuccess(SAMPLE);
      expect(await repo.searchLines({})).toHaveLength(3);
    });
  });

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  it('fetches the catalog at most once', async () => {
    mockFetchSuccess(SAMPLE);
    await repo.listOpenings();
    await repo.listLines('ruy-lopez');
    await repo.getLine('queens-gambit-main');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('reset() forces a re-fetch', async () => {
    mockFetchSuccess(SAMPLE);
    await repo.listOpenings();
    repo.reset();
    await repo.listOpenings();
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  // -------------------------------------------------------------------------
  // Failures
  // -------------------------------------------------------------------------

  it('rejects on HTTP error', async () => {
    mockFetchHttpError(500);
    await expect(repo.listOpenings()).rejects.toThrow(/HTTP 500/);
  });

  it('rejects on network failure', async () => {
    mockFetchReject(new Error('boom'));
    await expect(repo.listOpenings()).rejects.toThrow('boom');
  });

  it('rejects on schema validation failure (missing lines field)', async () => {
    mockFetchSuccess({ version: '2026-05-03', openings: [] }); // no lines field
    await expect(repo.listOpenings()).rejects.toThrow(/schema validation/);
  });

  it('rejects on schema validation failure (wrong types)', async () => {
    mockFetchSuccess({ version: 1, openings: [], lines: [] }); // version should be string
    await expect(repo.listOpenings()).rejects.toThrow(/schema validation/);
  });

  it('rejects when openings have invalid color', async () => {
    const bad: unknown = {
      version: '2026-05-03',
      openings: [{ id: 'x', name: 'X', eco: 'A00', color: 'purple', line_ids: [] }],
      lines: [],
    };
    mockFetchSuccess(bad);
    await expect(repo.listOpenings()).rejects.toThrow(/schema validation/);
  });
});
