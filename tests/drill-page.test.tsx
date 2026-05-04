/**
 * Render test for DrillPage — confirms loading → ready transition with a
 * mock OpeningRepository injected via _setRepositoryForTesting.
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
import type { Line, Opening, OpeningRepository, SearchQuery } from '../src/storage/types';
import { renderWithProviders } from './test-utils';

const opening: Opening = {
  id: 'ruy-lopez',
  name: 'Ruy Lopez',
  eco: 'C60-C99',
  color: 'white',
  line_ids: ['ruy-lopez-main'],
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

  it('renders the Hint button and keyboard shortcut hint', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /hint/i }).length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/H hint/i).length).toBeGreaterThan(0);
  });

  it('collapses the move history rail when collapse button clicked', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByText(/Move history/i)).toBeTruthy();
    });

    const collapseBtn = screen.getByRole('button', { name: /collapse move history/i });
    fireEvent.click(collapseBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Move history/i)).toBeNull();
    });

    // Floating expand pill is rendered when collapsed.
    expect(screen.getByRole('button', { name: /show move history/i })).toBeTruthy();
    expect(window.localStorage.getItem('tabiya.moveRailCollapsed')).toBe('1');
  });

  it('restores collapsed rail on mount when localStorage flag set', async () => {
    window.localStorage.setItem('tabiya.moveRailCollapsed', '1');
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show move history/i })).toBeTruthy();
    });
    expect(screen.queryByText(/Move history/i)).toBeNull();
  });

  it('expands rail again from floating pill', async () => {
    window.localStorage.setItem('tabiya.moveRailCollapsed', '1');
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /show move history/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /show move history/i }));

    await waitFor(() => {
      expect(screen.getByText(/Move history/i)).toBeTruthy();
    });
    expect(window.localStorage.getItem('tabiya.moveRailCollapsed')).toBe('0');
  });

  it('renders next-move accent on the expected ply during awaiting_player', async () => {
    const repo = new MockRepo();
    _setRepositoryForTesting(repo);

    renderWithProviders(<DrillPage />, { route: '/drill' });
    repo.resolveLater();

    await waitFor(() => {
      expect(screen.getByText(/Move history/i)).toBeTruthy();
    });

    // playerColor = 'white' (opening.color), so initial state is awaiting_player
    // at lineIndex 0. Cell index 0 is the next-expected ply ('e4').
    const cell0 = screen.getByTestId('move-cell-0');
    expect(cell0.style.color).toMatch(/rgb/);  // accent color applied
    // borderBottom should be styled (accent line) — read computed style.
    expect(cell0.style.borderBottom).toContain('2px solid');
  });
});
