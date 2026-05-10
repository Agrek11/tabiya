/**
 * Render tests for DrillPage — wireframe v1.1 layout.
 *
 * Confirms loading → ready transition, error state, hint button presence,
 * collapsible move-history disclosure (default closed), and next-move accent.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

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

  it('renders Restart, Skip, and Hint action chips', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^restart$/i })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /^skip$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^hint$/i })).toBeTruthy();
  });

  it('renders the mode dropdown defaulting to Theory', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /switch mode/i })).toBeTruthy();
    });
    expect(screen.getAllByText(/Theory/i).length).toBeGreaterThan(0);
  });

  it('move history is open by default and toggles closed on click', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    const toggle = await screen.findByRole('button', { name: /toggle move history/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByTestId('move-cell-0')).toBeTruthy();

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(toggle.getAttribute('aria-expanded')).toBe('false');
    });
    expect(screen.queryByTestId('move-cell-0')).toBeNull();
    expect(window.localStorage.getItem('tabiya.drillHistoryOpen')).toBe('0');
  });

  it('restores history closed on mount when localStorage flag set to 0', async () => {
    window.localStorage.setItem('tabiya.drillHistoryOpen', '0');
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /toggle move history/i })).toBeTruthy();
    });
    const toggle = screen.getByRole('button', { name: /toggle move history/i });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByTestId('move-cell-0')).toBeNull();
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
    // at lineIndex 0. Cell index 0 is the next-expected ply ('e4').
    const cell0 = screen.getByTestId('move-cell-0');
    expect(cell0.style.color).toMatch(/rgb/);  // accent color applied
    expect(cell0.style.borderBottom).toContain('2px solid');
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
