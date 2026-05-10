/**
 * Render tests for RepertoirePage — Phase 0d.3 family-card UX.
 *
 * Confirms loading → ready transition, family card render, expand/collapse
 * behavior, search filter, category filter, and gambits link presence.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';

import { RepertoirePage } from '../src/pages/RepertoirePage';
import { _setRepositoryForTesting } from '../src/storage';
import type {
  Family,
  Line,
  Opening,
  OpeningRepository,
  SearchQuery,
  Variation,
} from '../src/storage/types';
import { renderWithProviders } from './test-utils';

const families: Family[] = [
  {
    id: 'open-games',
    name: 'Open Games',
    category: 'open',
    eco_range: 'C20-C99',
    opening_ids: ['ruy-lopez', 'italian-game'],
  },
  {
    id: 'closed-games',
    name: 'Closed Games',
    category: 'closed',
    eco_range: 'D00-D69',
    opening_ids: ['queens-gambit'],
  },
];

const openings: Opening[] = [
  {
    id: 'ruy-lopez',
    family_id: 'open-games',
    name: 'Ruy Lopez',
    eco: 'C60-C99',
    color: 'white',
    line_ids: ['ruy-lopez-main'],
    is_gambit: false,
  },
  {
    id: 'italian-game',
    family_id: 'open-games',
    name: 'Italian Game',
    eco: 'C50-C59',
    color: 'white',
    line_ids: ['italian-game-main'],
    is_gambit: false,
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
];

class MockRepo implements OpeningRepository {
  async listOpenings(): Promise<Opening[]> {
    return openings;
  }
  async getOpening(id: string): Promise<Opening | null> {
    return openings.find((o) => o.id === id) ?? null;
  }
  async listLines(): Promise<Line[]> {
    return [];
  }
  async getLine(): Promise<Line | null> {
    return null;
  }
  async searchLines(_q: SearchQuery): Promise<Line[]> {
    return [];
  }
  async listFamilies(): Promise<Family[]> {
    return families;
  }
  async getFamily(id: string): Promise<Family | null> {
    return families.find((f) => f.id === id) ?? null;
  }
  async listOpeningsByFamily(familyId: string): Promise<Opening[]> {
    return openings.filter((o) => o.family_id === familyId);
  }
  async listGambits(): Promise<Opening[]> {
    return openings.filter((o) => o.is_gambit);
  }
  async listVariations(): Promise<Variation[]> { return []; }
  async getVariation(): Promise<null> { return null; }
  async listVariationsByFamily(): Promise<Variation[]> { return []; }
  async listLinesByVariation(): Promise<Line[]> { return []; }
}

beforeEach(() => {
  _setRepositoryForTesting(new MockRepo());
});

afterEach(() => {
  cleanup();
  _setRepositoryForTesting(null);
});

describe('RepertoirePage', () => {
  it('renders family cards after load', async () => {
    renderWithProviders(<RepertoirePage />);
    await waitFor(() => {
      expect(screen.getByText('Open Games')).toBeTruthy();
      expect(screen.getByText('Closed Games')).toBeTruthy();
    });
  });

  it('child openings hidden until family card clicked', async () => {
    renderWithProviders(<RepertoirePage />);
    await waitFor(() => screen.getByText('Open Games'));
    expect(screen.queryByText('Ruy Lopez')).toBeNull();

    fireEvent.click(screen.getByText('Open Games'));
    expect(screen.getByText('Ruy Lopez')).toBeTruthy();
    expect(screen.getByText('Italian Game')).toBeTruthy();
  });

  it('search filters families by opening name', async () => {
    renderWithProviders(<RepertoirePage />);
    await waitFor(() => screen.getByText('Open Games'));

    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: 'queen' } });

    await waitFor(() => {
      expect(screen.queryByText('Open Games')).toBeNull();
      expect(screen.getByText('Closed Games')).toBeTruthy();
    });
  });

  it('category chip filters family list', async () => {
    renderWithProviders(<RepertoirePage />);
    await waitFor(() => screen.getByText('Open Games'));

    fireEvent.click(screen.getByRole('button', { name: 'Closed' }));

    await waitFor(() => {
      expect(screen.queryByText('Open Games')).toBeNull();
      expect(screen.getByText('Closed Games')).toBeTruthy();
    });
  });

  it('shows gambits link with count', async () => {
    renderWithProviders(<RepertoirePage />);
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /gambits/i });
      expect(link.getAttribute('href')).toBe('/repertoire/gambits');
    });
  });
});
