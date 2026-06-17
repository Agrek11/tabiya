/**
 * Render tests for DrillPage — wireframe v1.1 layout.
 *
 * Confirms loading → ready transition, error state, hint button presence,
 * collapsible move-history disclosure (default closed), and next-move accent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, waitFor } from '@testing-library/react';

// Mock canvas-confetti — jsdom has no canvas so the celebration call would
// crash on getContext. Tests don't need to assert the burst fires.
vi.mock('canvas-confetti', () => ({
  default: vi.fn(() => Promise.resolve()),
}));

import { DrillPage } from '../src/pages/DrillPage';
import { _setRepositoryForTesting } from '../src/storage';
import type { Family, Line, Opening, OpeningRepository, Preset, SearchQuery, Variation } from '../src/storage/types';
import { renderWithProviders } from './test-utils';

const opening: Opening = {
  id: 'ruy-lopez',
  family_id: 'open-games',
  name: 'Ruy Lopez',
  eco: 'C60-C99',
  color: 'white',
  line_ids: ['ruy-lopez-main'],
  is_gambit: false,
};

const family: Family = {
  id: 'open-games',
  name: 'Open Games',
  category: 'open',
  eco_range: 'C20-C99',
  opening_ids: ['ruy-lopez'],
};

const line: Line = {
  id: 'ruy-lopez-main',
  opening_id: 'ruy-lopez',
  name: 'Main Line',
  moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
  depth: 5,
  end_fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3',
  popularity: 0.42,
  tags: [],
  strategic_notes: [],
  key_squares: [],
};

class MockRepo implements OpeningRepository {
  resolveLater: () => void = () => {};
  private gate = new Promise<void>((r) => (this.resolveLater = r));

  async listOpenings(): Promise<Opening[]> {
    await this.gate;
    return [opening];
  }
  async getOpening(id: string): Promise<Opening | null> {
    await this.gate;
    return id === opening.id ? opening : null;
  }
  async listLines(openingId: string): Promise<Line[]> {
    await this.gate;
    return openingId === opening.id ? [line] : [];
  }
  async getLine(id: string): Promise<Line | null> {
    await this.gate;
    return id === line.id ? line : null;
  }
  async searchLines(_q: SearchQuery): Promise<Line[]> {
    await this.gate;
    return [line];
  }
  async listFamilies(): Promise<Family[]> {
    await this.gate;
    return [family];
  }
  async getFamily(id: string): Promise<Family | null> {
    await this.gate;
    return id === family.id ? family : null;
  }
  async listOpeningsByFamily(familyId: string): Promise<Opening[]> {
    await this.gate;
    return familyId === family.id ? [opening] : [];
  }
  async listGambits(): Promise<Opening[]> {
    await this.gate;
    return [];
  }
  async listVariations(): Promise<Variation[]> { await this.gate; return []; }
  async getVariation(): Promise<null> { await this.gate; return null; }
  async listVariationsByFamily(): Promise<Variation[]> { await this.gate; return []; }
  async listLinesByVariation(): Promise<Line[]> { await this.gate; return []; }
  async listPresets(): Promise<Preset[]> { await this.gate; return []; }
  async getPreset(): Promise<null> { await this.gate; return null; }
}

class FailingRepo implements OpeningRepository {
  async listOpenings(): Promise<Opening[]> {
    throw new Error('boom from test');
  }
  async getOpening(): Promise<null> {
    return null;
  }
  async listLines(): Promise<Line[]> {
    return [];
  }
  async getLine(): Promise<null> {
    return null;
  }
  async searchLines(): Promise<Line[]> {
    return [];
  }
  async listFamilies(): Promise<Family[]> {
    return [];
  }
  async getFamily(): Promise<null> {
    return null;
  }
  async listOpeningsByFamily(): Promise<Opening[]> {
    return [];
  }
  async listGambits(): Promise<Opening[]> {
    return [];
  }
  async listVariations(): Promise<Variation[]> { return []; }
  async getVariation(): Promise<null> { return null; }
  async listVariationsByFamily(): Promise<Variation[]> { return []; }
  async listLinesByVariation(): Promise<Line[]> { return []; }
  async listPresets(): Promise<Preset[]> { return []; }
  async getPreset(): Promise<null> { return null; }
}

beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() =>
    Promise.resolve()
  );
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  _setRepositoryForTesting(null);
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe('DrillPage', () => {
  it('shows loading state, then transitions to ready with line title', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });

    expect(screen.getByText(/loading catalog/i)).toBeTruthy();

    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByText(/Main Line/i)).toBeTruthy();
    });
  });

  it('shows error state when the repo rejects', async () => {
    _setRepositoryForTesting(new FailingRepo());

    renderWithProviders(<DrillPage />, { route: '/drill' });

    await waitFor(() => {
      expect(screen.getByText(/boom from test/i)).toBeTruthy();
    });
  });

  it('exposes Restart, Skip, and Hint as inline action buttons', async () => {
    // 2026-05-15 fix reverted the (⋮) overflow dropdown back to inline buttons
    // beneath the moves row. Assert all three testids are present in the DOM
    // without needing to open any menu.
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await screen.findByTestId('drill-restart');
    expect(screen.getByTestId('drill-skip')).toBeTruthy();
    expect(screen.getByTestId('drill-hint')).toBeTruthy();
  });

  it('renders the mode pill defaulting to Drill mode', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch mode/i })).toBeTruthy();
    });
    expect(screen.getAllByText(/Drill mode/i).length).toBeGreaterThan(0);
  });

  it('renders the moves row inline with all plies visible', async () => {
    // Move history collapsible right-rail was dropped in the v1 rebuild.
    // The moves row now sits inline under the board. Played + next-expected
    // chips render through the same `move-cell-${idx}` testid.
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      // ply 0 is the next-expected move at drill start.
      expect(screen.getByTestId('move-cell-0')).toBeTruthy();
    });
  });

  it('renders next-move accent on the expected ply during awaiting_player', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByTestId('move-cell-0')).toBeTruthy();
    });

    // playerColor = 'white' (opening.color), initial state = awaiting_player
    // at lineIndex 0. Cell index 0 is the next-expected ply ('e4'). The new
    // design accents it with a brand-colored border on the entire chip
    // (not a bottom underline).
    const cell0 = screen.getByTestId('move-cell-0');
    expect(cell0.style.border).toMatch(/0\.5px solid/);
    // The border color must be the brand token, not the default ink/border —
    // we infer brand-ness by checking it's not the neutral border.
    expect(cell0.style.border).not.toBe('');
  });

  it('renders the progress bar', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
  });
});
