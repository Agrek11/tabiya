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
  families: [
    {
      id: 'open-games',
      name: 'Open Games',
      category: 'open',
      eco_range: 'C20-C99',
      tier: 1,
      opening_ids: ['ruy-lopez', 'italian-game'],
    },
    {
      id: 'closed-games',
      name: 'Closed Games',
      category: 'closed',
      eco_range: 'D00-D69',
      tier: 1,
      opening_ids: ['queens-gambit'],
    },
    {
      id: 'gambits',
      name: 'Gambits',
      category: 'gambit',
      eco_range: '',
      tier: 3,
      opening_ids: ['italian-game'],
    },
  ],
  variations: [
    {
      id: 'spanish-closed',
      family_id: 'open-games',
      name: 'Closed Spanish',
      eco: 'C84',
      color: 'white',
      trunk_moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
      line_ids: ['ruy-lopez-main'],
    },
  ],
  openings: [
    {
      id: 'ruy-lopez',
      family_id: 'open-games',
      name: 'Ruy Lopez',
      eco: 'C60-C99',
      color: 'black',
      line_ids: ['ruy-lopez-main'],
      is_gambit: false,
    },
    {
      id: 'italian-game',
      family_id: 'open-games',
      name: 'Italian Game',
      eco: 'C50-C59',
      color: 'black',
      line_ids: ['italian-game-main'],
      is_gambit: true,
    },
    {
      id: 'queens-gambit',
      family_id: 'closed-games',
      name: "Queen's Gambit",
      eco: 'D06-D69',
      color: 'white',
      line_ids: ['queens-gambit-main'],
      is_gambit: false,
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
  // Family layer (Phase 0d.3)
  // -------------------------------------------------------------------------

  describe('families', () => {
    it('listFamilies returns all families', async () => {
      mockFetchSuccess(SAMPLE);
      const result = await repo.listFamilies();
      expect(result).toHaveLength(3);
      expect(result.map((f) => f.id)).toEqual(['open-games', 'closed-games', 'gambits']);
    });

    it('getFamily returns the matching family', async () => {
      mockFetchSuccess(SAMPLE);
      const fam = await repo.getFamily('open-games');
      expect(fam?.name).toBe('Open Games');
      expect(fam?.opening_ids).toEqual(['ruy-lopez', 'italian-game']);
    });

    it('getFamily returns null for unknown id', async () => {
      mockFetchSuccess(SAMPLE);
      expect(await repo.getFamily('nope')).toBeNull();
    });

    it('listOpeningsByFamily filters by family_id', async () => {
      mockFetchSuccess(SAMPLE);
      const ops = await repo.listOpeningsByFamily('open-games');
      expect(ops.map((o) => o.id).sort()).toEqual(['italian-game', 'ruy-lopez']);
    });

    it('listOpeningsByFamily returns empty for unknown family', async () => {
      mockFetchSuccess(SAMPLE);
      expect(await repo.listOpeningsByFamily('nope')).toEqual([]);
    });

    it('listGambits returns only openings flagged is_gambit', async () => {
      mockFetchSuccess(SAMPLE);
      const gambits = await repo.listGambits();
      expect(gambits).toHaveLength(1);
      expect(gambits[0]!.id).toBe('italian-game');
    });
  });

  // -------------------------------------------------------------------------
  // Variations (curated v2)
  // -------------------------------------------------------------------------

  describe('variations', () => {
    it('listVariations returns all variations', async () => {
      mockFetchSuccess(SAMPLE);
      const result = await repo.listVariations();
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('spanish-closed');
    });

    it('getVariation returns the matching variation', async () => {
      mockFetchSuccess(SAMPLE);
      const v = await repo.getVariation('spanish-closed');
      expect(v?.name).toBe('Closed Spanish');
    });

    it('getVariation returns null for unknown id', async () => {
      mockFetchSuccess(SAMPLE);
      expect(await repo.getVariation('nope')).toBeNull();
    });

    it('listVariationsByFamily filters by family_id', async () => {
      mockFetchSuccess(SAMPLE);
      const list = await repo.listVariationsByFamily('open-games');
      expect(list).toHaveLength(1);
      expect(list[0]!.id).toBe('spanish-closed');
    });

    it('listVariationsByFamily returns empty for unknown family', async () => {
      mockFetchSuccess(SAMPLE);
      expect(await repo.listVariationsByFamily('nope')).toEqual([]);
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
